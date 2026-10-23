"use client";

import { updateUserRoleAction, updateUserStatusAction, removeUserAction } from "@/app/admin/users/actions";

type Props = {
  userId: string;
  userName: string;
  status: "ACTIVE" | "SUSPENDED";
  currentRole: string;
  roleOptions: Array<{ code: string; label: string }>;
  canEditRole: boolean;
  canChangeStatus: boolean;
  canRemove: boolean;
};

export function UserAccountActions({ userId, userName, status, currentRole, roleOptions, canEditRole, canChangeStatus, canRemove }: Props) {
  return <div className="space-y-2">
    {canEditRole && <form action={updateUserRoleAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>নতুন ভূমিকা</label>
      <select id={`role-${userId}`} name="roleCode" defaultValue={currentRole} className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs">
        {roleOptions.map((role) => <option key={role.code} value={role.code}>{role.label}</option>)}
      </select>
      <button type="submit" className="rounded-lg bg-forest px-3 py-1.5 text-xs font-bold text-white">ভূমিকা বদল</button>
    </form>}
    {canChangeStatus && <form action={updateUserStatusAction} className="inline-block">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} />
      <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold">{status === "ACTIVE" ? "স্থগিত করুন" : "পুনরায় সক্রিয়"}</button>
    </form>}
    {canRemove && <form action={removeUserAction} className="inline-block" onSubmit={(event) => {
      if (!window.confirm(`“${userName}” অ্যাকাউন্ট অপসারণ করবেন? লগইন ও সেশন বন্ধ হবে; আর্থিক যাচাইয়ের রেকর্ড audit-এর জন্য থাকবে।`)) event.preventDefault();
    }}>
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className="rounded-lg border border-red-brand/40 px-3 py-1.5 text-xs font-semibold text-red-brand">অ্যাকাউন্ট অপসারণ</button>
    </form>}
  </div>;
}
