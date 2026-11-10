/** What the overview driver needs from its devices during repair. */
export interface OrganizationScope {
  getOrganizationIds(): string[] | undefined;
  setOrganizationIds(organizationIds: string[]): Promise<void>;
}
