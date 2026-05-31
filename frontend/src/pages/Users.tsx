import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
} from '@/lib/queries';
import { useAuth } from '@/stores/auth';
import { useToast } from '@/stores/toast';
import { errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { User, Role } from '@/lib/types';

const ROLES: Role[] = ['ADMIN', 'MANAGER', 'MEMBER'];
const CREATE_ROLES: Role[] = ['MANAGER', 'MEMBER'];

const createSchema = z.object({
  name: z.string().min(2, 'At least 2 characters'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'At least 8 characters'),
  role: z.enum(['MANAGER', 'MEMBER']),
});

const editSchema = z.object({
  name: z.string().min(2, 'At least 2 characters'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'At least 8 characters').or(z.literal('')),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  MEMBER: 'bg-gray-100 text-gray-700',
};

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const createUser = useCreateUser();
  const toast = useToast((s) => s.push);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'MEMBER' },
  });

  const onSubmit = async (values: CreateForm) => {
    setServerError(null);
    try {
      await createUser.mutateAsync(values);
      toast(`User "${values.name}" created`, 'success');
      onClose();
    } catch (err) {
      const msg = errorMessage(err, 'Could not create user');
      setServerError(msg);
    }
  };

  const field =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold">New user</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name</label>
          <input type="text" className={field} {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email</label>
          <input type="email" className={field} {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Password</label>
          <input type="password" className={field} {...register('password')} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Role</label>
          <select className={field} {...register('role')}>
            {CREATE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">To assign ADMIN, create the user then edit their role.</p>
        </div>

        {serverError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || createUser.isPending}>
            {createUser.isPending ? 'Creating…' : 'Create user'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function EditUserDialog({
  user,
  currentUserId,
  onClose,
}: {
  user: User;
  currentUserId: string | undefined;
  onClose: () => void;
}) {
  const updateUser = useUpdateUser();
  const toast = useToast((s) => s.push);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: user.name, email: user.email, password: '', role: user.role },
  });

  const watchedRole = useWatch({ control, name: 'role' });
  const isSelf = user.id === currentUserId;
  const selfRoleDemotion = isSelf && user.role === 'ADMIN' && watchedRole !== 'ADMIN';

  const onSubmit = async (values: EditForm) => {
    setServerError(null);
    try {
      const payload: { name: string; email: string; role: Role; password?: string } = {
        name: values.name,
        email: values.email,
        role: values.role,
      };
      if (values.password) payload.password = values.password;
      await updateUser.mutateAsync({ id: user.id, data: payload });
      toast(`User "${values.name}" updated`, 'success');
      onClose();
    } catch (err) {
      const msg = errorMessage(err, 'Could not update user');
      setServerError(msg);
    }
  };

  const field =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold">Edit user</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name</label>
          <input type="text" className={field} {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email</label>
          <input type="email" className={field} {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">New password</label>
          <input type="password" className={field} placeholder="Leave blank to keep current" {...register('password')} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Role</label>
          <select className={field} {...register('role')}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {selfRoleDemotion && (
          <p className="rounded-md bg-yellow-50 border border-yellow-300 px-3 py-2 text-sm text-yellow-800">
            Warning: you are changing your own role from ADMIN. You will lose admin access immediately after saving.
          </p>
        )}

        {serverError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || updateUser.isPending}>
            {updateUser.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function DeleteConfirmDialog({
  user,
  onConfirm,
  onClose,
  isPending,
}: {
  user: User;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold">Delete user</h2>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <strong>{user.name}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const navigate = useNavigate();
  const currentUser = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const { data: users, isLoading, isError } = useUsers();
  const deleteUser = useDeleteUser();
  const toast = useToast((s) => s.push);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const logout = () => {
    clear();
    navigate('/login');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser.mutateAsync(deleteTarget.id);
      toast(`User "${deleteTarget.name}" deleted`, 'success');
      setDeleteTarget(null);
    } catch (err) {
      toast(errorMessage(err, 'Could not delete user'), 'error');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex items-center justify-between gap-3 border-b bg-card px-6 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Board
          </button>
          <h1 className="text-base font-semibold">User Management</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <p className="font-medium">{currentUser?.name}</p>
            <p className="text-muted-foreground">{currentUser?.role}</p>
          </div>
          <Button size="sm" variant="outline" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {users ? `${users.length} user${users.length !== 1 ? 's' : ''}` : ''}
            </p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              + New user
            </Button>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Loading users…</p>}
          {isError && <p className="text-sm text-destructive">Failed to load users.</p>}

          {!isLoading && !isError && users && (
            <div className="rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        {u.name}
                        {u.id === currentUser?.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role]}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditTarget(u)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={u.id === currentUser?.id}
                            onClick={() => setDeleteTarget(u)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} />}
      {editTarget && (
        <EditUserDialog
          user={editTarget}
          currentUserId={currentUser?.id}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmDialog
          user={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          isPending={deleteUser.isPending}
        />
      )}
    </div>
  );
}
