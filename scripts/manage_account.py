#!/usr/bin/env python3
"""Account administration for the prototype: list, inspect, delete.

SAME TRUST BOUNDARY AS scripts/approve_doctor.py
    Running this requires write access to the server's account store, i.e. you are the
    operator of the deployment. It has no network surface, accepts no token, and cannot
    be triggered by any API call, request body or signup form.

WHY THERE IS NO "CHANGE ROLE" COMMAND
    Deliberate. `role` is set once, at account creation, from the signup the person
    actually completed; `doctor_verified` is the only privilege that ever changes, and
    only through service.approve_doctor(). Adding a role-rewrite here would create
    exactly the escalation path the rest of the design exists to prevent.

    To move a person from a user account to a doctor account, DELETE the account and let
    them sign up again with Google choosing "Doctor Account". That collects the medical registration details, which a silent role flip would skip —
    leaving a "doctor" with no credentials on file and nothing for an administrator to
    check.

USAGE
    scripts/manage_account.py --list
    scripts/manage_account.py --show someone@gmail.com
    scripts/manage_account.py --delete someone@gmail.com
    scripts/manage_account.py --delete someone@gmail.com --yes     # skip the prompt

WHAT DELETING DOES NOT TOUCH
    Screening data. Scans, evidence and clinician reviews are stored separately and hold
    no account reference by design — the medical record does not depend on who was
    logged in. Deleting an account removes the account row and nothing else.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import argparse  # noqa: E402
import json  # noqa: E402

from src.auth.models import mask_mobile  # noqa: E402
from src.auth.storage import get_auth_store  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true", help="list every account")
    ap.add_argument("--show", metavar="EMAIL", help="show one account in full")
    ap.add_argument("--delete", metavar="EMAIL", help="permanently delete one account")
    ap.add_argument("--yes", action="store_true", help="do not prompt for confirmation")
    args = ap.parse_args()

    store = get_auth_store()

    if args.list or not (args.show or args.delete):
        accs = store.list_accounts()
        if not accs:
            print(f"No accounts. (store: {store.dir})")
            return 0
        print(f"{'ACCOUNT ID':<24}{'EMAIL':<32}{'ROLE':<9}{'DOCTOR OK':<11}CREATED")
        for a in accs:
            print(f"{a.account_id:<24}{a.email:<32}{a.role:<9}"
                  f"{str(a.doctor_verified):<11}{a.created_at[:19]}")
        return 0

    target = (args.show or args.delete).strip().lower()
    acc = store.get_by_email(target)
    if acc is None:
        print(f"No account for {target}", file=sys.stderr)
        return 1

    if args.show:
        d = acc.to_record()
        d["mobile"] = mask_mobile(d.get("mobile"))  # never print the full number
        print(json.dumps(d, indent=2))
        return 0

    # ---- delete -------------------------------------------------------------
    print(f"About to permanently delete:")
    print(f"  account   {acc.account_id}")
    print(f"  email     {acc.email}")
    print(f"  role      {acc.role}  (doctor_verified={acc.doctor_verified})")
    print(f"  created   {acc.created_at}")
    print("\nScans, evidence and clinician reviews are NOT affected.")

    if not args.yes:
        try:
            if input("\nType 'delete' to confirm: ").strip().lower() != "delete":
                print("aborted.")
                return 1
        except (EOFError, KeyboardInterrupt):
            print("\naborted.")
            return 1

    store.delete(acc.account_id)

    print(f"\nDeleted {acc.account_id}.")
    print(f"{acc.email} can now sign up again and choose an account type.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
