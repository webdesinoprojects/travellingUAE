export type AdminNavigationStatus = "draft" | "published" | "archived";

export type AdminHeaderNavigationItem = {
  id: string;
  parentId: string | null;
  label: string;
  href: string;
  hasDropdown: boolean;
  status: AdminNavigationStatus;
  sortOrder: number;
};

export type AdminFooterColumn = {
  id: string;
  title: string;
  status: AdminNavigationStatus;
  sortOrder: number;
};

export type AdminFooterLink = {
  id: string;
  columnId: string;
  label: string;
  href: string;
  status: AdminNavigationStatus;
  sortOrder: number;
};

export type AdminNavigationContent = {
  source: "database" | "unconfigured";
  headerItems: AdminHeaderNavigationItem[];
  footerColumns: AdminFooterColumn[];
  footerLinks: AdminFooterLink[];
};
