import { observer } from "mobx-react-lite";
import { Moon, Sun } from "lucide-react";
import { useStore } from "~/core/hooks/use-store";
import { PersonAvatar } from "~/core/components/common/person-avatar";

export const OrgHeader = observer(function OrgHeader() {
  const { auth, org, theme } = useStore();

  const user = auth.currentUser;

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-gray-200 bg-white">
      <span className="text-base font-semibold text-gray-900">{org.currentOrg?.name ?? "Cybernetic"}</span>

      <div className="flex items-center gap-3">
        <PersonAvatar
          email={user?.email}
          size="md"
        />

        <button
          type="button"
          onClick={() => theme.toggle()}
          className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Toggle theme"
        >
          {theme.mode === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>
      </div>
    </header>
  );
});
