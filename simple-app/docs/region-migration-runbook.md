# Moving Zane between Railway regions

Status: **executed 7 November 2026**, `us-west2` to `europe-west4`
(Netherlands). Rewritten afterwards from what actually happened.

The previous version of this document described a delete-and-restore
procedure that was never necessary and would have destroyed the live database
for no reason. It has been replaced rather than annotated: a wrong runbook
with a warning stapled to the top is still a wrong runbook, and the warning is
the first thing a reader skips.

This repository is public, so no project or service ids and no row-count
baseline appear here. The commands below produce them. A filled-in copy sits
beside the backup it describes, under `~/zane-volume-backups/<timestamp>/`.

## The short version

```bash
railway service scale --service <app>        eu-west=1 us-west=0
railway service scale --service <pocketbase> eu-west=1 us-west=0
```

Wait after each for that service's volume to report `READY` in the new region.
That is the whole migration. About eleven and a half minutes of downtime for
both services, most of it waiting.

## What was believed before doing it, and is false

**Railway volumes are not region-bound.** Scaling a service to another region
migrates its volume with it: the volume goes `MIGRATING`, then `READY` in the
new region, contents intact. Observed on both volumes, including the one
holding the production database.

The mistake was reasonable and expensive. `railway volume update` offers only
`--mount-path` and `--name`, with no region option, which reads as "a volume
cannot move". The conclusion drawn was that each volume must be deleted and
recreated and the data restored from backup: hours of work, an irreversible
step, and a real chance of losing everything, to achieve what two `scale`
commands do by themselves.

**So there is no irreversible step in this procedure**, and rollback is cheap.

## Why you might do this

Where data sits is a data-protection fact. Contracts held in the US are a
transfer of personal data out of the UK, needing a mechanism for every US
recipient. Held in the EEA they rest on UK adequacy instead.

It does **not** fix the review path. Contract text still goes to OpenRouter
and on to Anthropic, both US companies, so a review is a transfer out of the
EEA wherever the database sits. `ALLOWED_CLAIMS.data-residency` carries that
as its limit, and moving region does not let you drop it.

**Available regions**, printed by `railway service scale <bad-region>=1`:
`us-east`, `us-west`, `eu-west`, `southeast-asia`. There is no UK region.
`eu-west` (Amsterdam) is the only EEA option.

## Before you start

1. **Take a backup and verify it.** Not because the migration needs one, but
   because nothing that moves production data should happen without a tested
   backup in hand.

   Use PocketBase's own backup, **not** a copy of the volume:

   ```bash
   # from a context holding the service's environment
   pb.backups.create("premigration_<unix>.zip")
   ```

   PocketBase runs in **WAL mode**. A raw file copy taken while it is writing
   can be torn: `data.db` missing commits that are still in `data.db-wal`.
   PocketBase checkpoints before snapshotting, which is visible in the archive
   itself, where `data.db-wal` and `auxiliary.db-wal` are zero bytes. Because
   of that this needs **no downtime** and no stopping of the app, which the
   previous runbook wrongly required.

2. **Verify the archive before trusting it.**

   ```bash
   unzip -q -o <backup>.zip -d extracted
   sqlite3 extracted/data.db      "PRAGMA integrity_check;"   # expect: ok
   sqlite3 extracted/auxiliary.db "PRAGMA integrity_check;"   # expect: ok
   ls -la extracted/*-wal                                     # expect: 0 bytes
   for T in companies users uploaded_documents review_results \
            audit_log approval_contacts playbook_rules extracted_clauses; do
     echo "$T: $(sqlite3 extracted/data.db "SELECT COUNT(*) FROM $T;")"
   done
   ```

   **Write those counts down outside the repo.** They are the oracle for step
   6. A count not recorded before the move cannot be checked after it.

3. **Hash whatever is on the uploads volume**, so "byte-identical afterwards"
   is testable rather than asserted.

   ```bash
   railway volume files --volume <uploads-volume> download /<file> ./before/<file>
   shasum -a 256 ./before/*
   ```

## The migration

4. **Move the app service first**, deliberately: if volume migration
   misbehaves, discover it on the service whose volume holds uploads rather
   than on the one holding the database.

   ```bash
   railway service scale --service <app> eu-west=1 us-west=0
   ```

   Then poll until the **volume** reports `READY` in the new region. Do not
   stop at the service saying Online; the volume is the part that carries the
   data.

   ```bash
   PROJECT=$(railway status --json | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
   railway api "query { project(id: \"$PROJECT\") { volumes { edges { node { name volumeInstances { edges { node { region state } } } } } } } }"
   ```

   Expect `MIGRATING`, then `READY` with a `europe-west4-…` region.

5. **Move PocketBase and wait the same way.**

   ```bash
   railway service scale --service <pocketbase> eu-west=1 us-west=0
   ```

## Verification

Run all of it. Each check catches something the others miss.

6. **Collection counts against the oracle from step 2.** Matching counts are
   the test. "The site loads" is not: the app serves most pages without
   touching most tables, and looks healthy against an empty database.

7. **A real figure through real code.** Run `computePortfolio()` for a known
   company and compare with its previous value. This exercises the
   aggregation, the relations and the numeric columns together, which a row
   count does not.

8. **A file off the uploads volume, hashed.** Download the file from step 3
   again and compare the sha256. The only check that proves the volume
   migration carried bytes rather than an empty filesystem.

9. **The health endpoint.**

   ```bash
   curl -s https://www.zanelegal.ai/api/health | python3 -m json.tool
   ```

   Expect `status: ok` and `uploads.writable: true`.

10. **Sign in and open a contract.** Needs a human with credentials. The only
    check that exercises auth, database reads and file reads together.

11. **Read the region back from the API, never from config.** The repository
    pins no region anywhere, so the API is the only source of truth, and the
    claims register depends on it: `ALLOWED_CLAIMS.data-residency` is honest
    only while both volumes report a `europe-west4-…` region.

## Rollback

Cheap, which is the best thing about the real procedure:

```bash
railway service scale --service <pocketbase> us-west=1 eu-west=0
railway service scale --service <app>        us-west=1 eu-west=0
```

The volumes migrate back with their contents, the same way they came. No
restore, and the backup from step 1 is a second line of defence rather than
the only one.

## What held up, and what did not

**Held up.** Domains are attached to the *service*, not the region, so
`www.zanelegal.ai` and `app.zanelegal.ai` stayed `ACTIVE` throughout and no
DNS change was needed. Every verification step caught what it was meant to.
The WAL warning was right, and is why step 1 uses PocketBase's own backup.

**Did not.** The claim that volumes must be deleted and recreated, which was
the centre of the previous document. Also the assumption that the Railway CLI
would refuse volume deletion from an agent the way it refuses file deletion
(`Refusing: agents cannot delete files`). It does not, which made the wrong
procedure dangerously easy to carry out.

**Caught afterwards.** The bucket is shared between PocketBase's database
archives and the uploads backup. `backupHealth.ts` filters to `.zip` keys at
the bucket root for that reason: without it the newest "database backup"
resolves to an uploads run-marker and reports healthy while saying nothing
about the database.

## Afterwards

Update the copy in the same commit as the move, or the site states a location
that is no longer true:

- `client/src/content/claims.ts`: `data-residency`, with its limit about the
  model providers.
- `client/src/content/security.ts`: residency belongs under what the product
  **does**, not under what it does not.
- `client/src/content/legal.ts`: the processors, transfers and retention
  sections, and the header comment at the top of that file, which records
  established facts and goes stale silently.

Two notes on the volumes themselves:

- The uploads volume was provisioned at 50 GB by default against PocketBase's
  500 MB, and size is not adjustable from the CLI. Worth checking what that
  costs.
- `_collections` reports more rows than `pb:setup` creates, the difference
  being PocketBase's own system collections. Still unconfirmed, so do not lean
  on that number as a verification check.
