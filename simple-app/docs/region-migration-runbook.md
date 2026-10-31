# Moving Zane's hosting from us-west2 to eu-west

Status: **prepared and partially rehearsed, not executed.** Written 31 October 2026.

This repository is public, so the concrete values for this deployment are
deliberately not in here: no project or service ids, and no row-count
baseline. The commands below produce them. A filled-in copy is kept beside
the backup it describes, under `~/zane-volume-backups/<timestamp>/`.

## Why

Customer contract data is stored in the United States. The `pocketbase-volume`
holding the database, extracted clause text and the audit record is in
Railway's `us-west2`; the application runs in `us-west`. Every upload is
therefore a transfer of personal data out of the UK, which needs a transfer
mechanism for each US recipient.

Moving to `eu-west` (Amsterdam, Netherlands) removes most of that problem. The
UK has deemed the EEA adequate, so a UK→Netherlands transfer needs no IDTA.
It does not remove the OpenRouter and Anthropic transfers: contract text still
goes to US companies during a review, and those still need their own basis.

**Available regions** (from `railway service scale <bad-region>=1`, which
prints the list): `us-east`, `us-west`, `eu-west`, `southeast-asia`. There is
no UK region. `eu-west` is the only EEA option.

## What makes this harder than it sounds

**Railway volumes are region-bound and cannot be moved.** `railway volume
update` offers only `--mount-path` and `--name`; there is no region or size
option. Migrating means deleting each volume and recreating it, then restoring
the data. This is a data migration, not a settings change.

**The CLI refuses destructive operations from an agent.** Verified:

```
$ railway volume files --volume zsg-starter-volume delete /restore-probe.txt --yes
Refusing: agents cannot delete files. Ask a human to run: ...
```

Every delete step below must be run by a person. Assume the same for volume
deletion.

**PocketBase runs in WAL mode.** `PRAGMA journal_mode` on the live database
returns `wal`. A copy taken while PocketBase is writing can be a torn snapshot,
because the `-wal` file holds commits not yet in `data.db`. The backup taken on
31 October happened to be clean (no writes since 27 October, and no `-wal` file
present), but **do not rely on that**: stop the service before the final copy.

## Pre-flight

1. **Announce downtime.** The site is live. Expect 15 to 45 minutes.

2. **Stop writes to PocketBase.** Scale the app service to zero so nothing
   writes mid-copy:

   ```bash
   railway service scale --service zsg-starter us-west=0
   ```

3. **Take the authoritative backup, with the service stopped.**

   ```bash
   BK=~/zane-volume-backups/$(date -u +%Y%m%dT%H%M%SZ)
   mkdir -p "$BK"
   railway volume files --volume pocketbase-volume download / "$BK/pocketbase-volume"
   railway volume files --volume zsg-starter-volume download / "$BK/zsg-starter-volume"
   ```

4. **Verify the backup before trusting it.** An unverified backup is a
   hypothesis.

   ```bash
   DB="$BK/pocketbase-volume/data.db"
   sqlite3 "$DB" "PRAGMA integrity_check;"          # expect: ok
   sqlite3 "$DB" "PRAGMA journal_mode;"             # expect: wal
   sqlite3 "$BK/pocketbase-volume/auxiliary.db" "PRAGMA integrity_check;"
   sqlite3 "$DB" "SELECT COUNT(*) FROM _collections;"
   for T in companies uploaded_documents review_results audit_log approval_contacts; do
     echo "$T: $(sqlite3 "$DB" "SELECT COUNT(*) FROM $T;")"
   done
   ```

   Record these counts. They are what you check against after the restore.

   Write the output somewhere outside the repo, next to the backup itself.
   These numbers are the only thing that tells you afterwards whether the
   restore was complete, and a count you did not record before the migration
   is a count you cannot check against after it.

5. **Confirm there is no `-wal` file left behind**, which would mean the copy
   is incomplete:

   ```bash
   railway volume files --volume pocketbase-volume list /
   ```

   Expect exactly: `auxiliary.db  data.db  lost+found/  storage/  types.d.ts`.
   Anything ending `-wal` or `-shm` means the service is still writing. Go back
   to step 2.

## Migration

6. **Move compute to eu-west.**

   ```bash
   railway service scale --service pocketbase eu-west=1 us-west=0
   railway service scale --service zsg-starter eu-west=1 us-west=0
   ```

7. **Delete the old volumes.** A person must run these. This is the
   irreversible step: after it, the only copy of the data is the backup from
   step 3.

   ```bash
   railway volume delete --volume pocketbase-volume
   railway volume delete --volume zsg-starter-volume
   ```

8. **Recreate the volumes.** A volume is created in its service's region, so
   this only produces EU volumes if step 6 has taken effect. Verify the region
   before restoring.

   ```bash
   railway volume -s <pocketbase-service-id> add --mount-path /pb/pb_data
   railway volume -s <zsg-starter-service-id> add --mount-path /data/uploads
   ```

   Get the service ids with `railway status`, or:

   ```bash
   railway list --json | python3 -c 'import sys,json;
   [print(n.get("name"), n.get("id")) for n in json.load(sys.stdin)]'
   ```

   **Check the region before going further:**

   ```bash
   PROJECT=$(railway status --json | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
   railway api "query { project(id: \"$PROJECT\") { volumes { edges { node { name volumeInstances { edges { node { region mountPath state } } } } } } } }"
   ```

   Every `region` must read `eu-west…`. If any still reads `us-west2`, stop:
   restoring into it would move nothing and you would have taken the downtime
   for no benefit.

9. **Restore.** The upload path is rehearsed and round-trips byte-exact
   (verified 31 October with a probe file: uploaded, listed, downloaded,
   `diff` identical).

   ```bash
   railway volume files --volume pocketbase-volume upload "$BK/pocketbase-volume/data.db" /data.db
   railway volume files --volume pocketbase-volume upload "$BK/pocketbase-volume/auxiliary.db" /auxiliary.db
   railway volume files --volume pocketbase-volume upload "$BK/pocketbase-volume/types.d.ts" /types.d.ts
   ```

   Do not upload `lost+found`. If `storage/` has contents in your backup,
   upload those too; it was empty on 31 October.

10. **Bring the services up and check the internal URL.**

    ```bash
    railway service redeploy --service pocketbase --yes
    ```

    `POCKETBASE_URL` on `zsg-starter` points at the pocketbase service. If
    recreating the service changed its domain, update it:

    ```bash
    railway variable list --service zsg-starter | grep POCKETBASE_URL
    railway variable set POCKETBASE_URL=<new url> --service zsg-starter
    ```

## Verification

11. **The app is up and talking to the database.**

    ```bash
    curl -s https://www.zanelegal.ai/api/health | python3 -m json.tool
    ```

    Expect `status: ok`, and `uploads.writable: true`.

12. **The data is all there.** Download the restored database and compare
    against the counts recorded in step 4. Matching counts are the test; "the
    site loads" is not, because the app serves plenty of pages without
    touching most tables.

    ```bash
    railway volume files --volume pocketbase-volume download /data.db /tmp/restored.db
    for T in companies uploaded_documents review_results audit_log approval_contacts; do
      echo "$T: $(sqlite3 /tmp/restored.db "SELECT COUNT(*) FROM $T;")"
    done
    ```

13. **Sign in and open a contract.** The one check that exercises auth,
    PocketBase reads and file reads together. Needs a human with credentials.

14. **Confirm the new region is what the legal pages now have to say.** Once
    verified, `client/src/content/legal.ts` and `client/src/content/security.ts`
    both need updating: they currently state, correctly, that data is held in
    the United States. Update `NOT_YET_CLAIMS.data-residency` in
    `client/src/content/claims.ts` in the same commit.

## Rollback

Before step 7, rollback is free: scale back to `us-west=1` and nothing was
lost.

After step 7, the old volumes are gone and rollback means repeating steps 8
and 9 against `us-west` instead. The backup from step 3 is the only copy of
the data in that window, so do not start step 7 until step 4 has passed and
you have the backup on local disk, not only in a shell variable.

## Afterwards

- The uploads volume was provisioned at 50 GB by default against pocketbase's
  500 MB, and size is not adjustable from the CLI. Worth checking what that
  costs before recreating it at the same size.
- There is still no scheduled backup. Step 3 is a manual procedure, and the
  first backup this project ever had was taken on 31 October 2026 while
  preparing this document. A cron that runs it is the obvious follow-on, and
  would retire `NOT_YET_CLAIMS.backups`.
- `_collections` reports more rows than `pb:setup` creates, the difference
  being PocketBase's own system collections. That has not been confirmed, 
  so settle it before leaning on the collection count as a restore check.
