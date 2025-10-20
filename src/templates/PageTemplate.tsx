import { PageLayout } from "@/components/PageLayout";

export default function NewPage() {
  return (
    <PageLayout title="New Page">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">New Page</h1>
          <p className="text-muted-foreground">
            This is a template for creating new pages.
          </p>
        </div>

        <div className="space-y-4">
          {/* Add your page content here */}
          <div className="rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-2">Content Section</h2>
            <p className="text-muted-foreground">
              Replace this with your actual page content.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

/*
To create a new page:

1. Copy this template to src/pages/YourPageName.tsx
2. Update the component name and page title
3. Add your page content
4. Add the route to src/config/routes.ts
5. Add navigation item to src/config/navigation.ts (if needed)
6. The page will automatically appear in the app!

Example:
- Copy to src/pages/Users.tsx
- Change component name to Users
- Update title to "Users"
- Add route: { path: "/users", component: Users, protected: true, title: "Users" }
- Add navigation: { title: "Users", url: "/users", icon: IconUsers }
*/
