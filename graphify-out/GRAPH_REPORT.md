# Graph Report - Dashboard_Test  (2026-08-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1961 nodes · 3340 edges · 161 communities (153 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `229e4ea4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cn
- cn
- custom-fetch.ts
- labops/src/App.tsx
- labops/src/components/ui/sidebar.tsx
- mockup-sandbox/src/components/ui/sidebar.tsx
- collector.test.ts
- mockup-sandbox/src/lib/utils.ts
- labops/src/lib/utils.ts
- devDependencies
- authorization.ts
- devDependencies
- auth-openid-client.integration.test.ts
- schema/index.ts
- app.ts
- monitoring.ts
- labops/src/components/ui/field.tsx
- labops/src/hooks/use-toast.ts
- mockup-sandbox/src/components/ui/field.tsx
- mockup-sandbox/src/hooks/use-toast.ts
- compilerOptions
- labops/src/components/ui/pagination.tsx
- mockup-sandbox/src/components/ui/pagination.tsx
- labops.ts
- job-leadership.ts
- lib/api.ts
- auth-store.ts
- collector-jobs.ts
- labops/src/components/ui/item.tsx
- dependencies
- mockupPreviewPlugin
- package.json
- auth-oidc.ts
- auth-gate.tsx
- mockup-sandbox/components.json
- devDependencies
- lib/reachability.ts
- labops/components.json
- labops/src/components/ui/command.tsx
- mockup-sandbox/src/components/ui/command.tsx
- metrics.ts
- ConfigGenerator.tsx
- webhook-notifications.ts
- labops/src/components/ui/carousel.tsx
- mockup-sandbox/src/App.tsx
- mockup-sandbox/src/components/ui/carousel.tsx
- saved-configurations.ts
- db/src/index.ts
- api-client-react/package.json
- labops/src/components/ui/input-group.tsx
- mockup-sandbox/src/components/ui/input-group.tsx
- mockup-sandbox/src/components/ui/item.tsx
- compilerOptions
- api-server/src/index.ts
- health.ts
- compilerOptions
- error-boundary.tsx
- labops/src/components/ui/chart.tsx
- mockup-sandbox/src/components/ui/chart.tsx
- compilerOptions
- scripts/package.json
- api-server/package.json
- runtime-config.ts
- labops/package.json
- setup-pdm.sh
- dependencies
- devDependencies
- ./tsconfig.base.json
- labops/tsconfig.json
- compilerOptions
- mockup-sandbox/package.json
- mockup-sandbox/tsconfig.json
- compilerOptions
- compilerOptions
- labops/src/components/ui/card.tsx
- mockup-sandbox/src/components/ui/table.tsx
- api-spec/package.json
- api-zod/package.json
- scripts
- auth.ts
- scripts/tsconfig.json
- @types/node
- csrf.ts
- rate-limiter.ts
- labops/src/components/ui/drawer.tsx
- labops/src/components/ui/empty.tsx
- labops/src/components/ui/navigation-menu.tsx
- mockup-sandbox/src/components/ui/empty.tsx
- mockup-sandbox/src/components/ui/navigation-menu.tsx
- mockup-sandbox/src/components/ui/select.tsx
- rate-limit.ts
- collector/package.json
- compilerOptions
- labops/src/components/ui/toggle-group.tsx
- lib
- mockup-sandbox/src/components/ui/toggle-group.tsx
- db/package.json
- @radix-ui/react-separator
- security-audit.ts
- scripts
- isDeviceInMaintenance
- labops/src/components/ui/alert.tsx
- mockup-sandbox/src/components/ui/alert.tsx
- orval.config.ts
- build.mjs
- class-variance-authority
- date-fns
- embla-carousel-react
- framer-motion
- @hookform/resolvers
- input-otp
- lucide-react
- next-themes
- @radix-ui/react-accordion
- @radix-ui/react-alert-dialog
- @radix-ui/react-aspect-ratio
- @radix-ui/react-tabs
- @radix-ui/react-checkbox
- @radix-ui/react-collapsible
- @radix-ui/react-context-menu
- react-dom
- @radix-ui/react-dropdown-menu
- @replit/vite-plugin-cartographer
- @radix-ui/react-label
- @radix-ui/react-menubar
- @types/react
- @radix-ui/react-popover
- @radix-ui/react-progress
- @radix-ui/react-radio-group
- @radix-ui/react-scroll-area
- @radix-ui/react-select
- @types/react-dom
- @radix-ui/react-slot
- @radix-ui/react-switch
- @radix-ui/react-toast
- @radix-ui/react-toggle
- @radix-ui/react-toggle-group
- @radix-ui/react-tooltip
- react-day-picker
- react-hook-form
- react-resizable-panels
- recharts
- @replit/vite-plugin-runtime-error-modal
- tailwind-merge
- tailwindcss
- tw-animate-css
- @vitejs/plugin-react
- layout.tsx
- labops/src/components/ui/sonner.tsx
- mockup-sandbox/src/components/ui/sonner.tsx
- @workspace/api-zod
- @workspace/db
- post-merge.sh

## God Nodes (most connected - your core abstractions)
1. `cn()` - 273 edges
2. `cn()` - 273 edges
3. `compilerOptions` - 23 edges
4. `createApp()` - 17 edges
5. `pool` - 16 edges
6. `customFetch()` - 11 edges
7. `cls()` - 11 edges
8. `mockupPreviewPlugin()` - 11 edges
9. `db` - 11 edges
10. `AuthStore` - 10 edges

## Surprising Connections (you probably didn't know these)
- `AlertDescription` --calls--> `cn()`  [EXTRACTED]
  artifacts/mockup-sandbox/src/components/ui/alert.tsx → artifacts/mockup-sandbox/src/lib/utils.ts
- `AlertTitle` --calls--> `cn()`  [EXTRACTED]
  artifacts/mockup-sandbox/src/components/ui/alert.tsx → artifacts/mockup-sandbox/src/lib/utils.ts
- `AlertDialogContent` --calls--> `cn()`  [EXTRACTED]
  artifacts/mockup-sandbox/src/components/ui/alert-dialog.tsx → artifacts/mockup-sandbox/src/lib/utils.ts
- `AlertDialogDescription` --calls--> `cn()`  [EXTRACTED]
  artifacts/mockup-sandbox/src/components/ui/alert-dialog.tsx → artifacts/mockup-sandbox/src/lib/utils.ts
- `AlertDialogFooter()` --calls--> `cn()`  [EXTRACTED]
  artifacts/mockup-sandbox/src/components/ui/alert-dialog.tsx → artifacts/mockup-sandbox/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (161 total, 8 thin omitted)

### Community 0 - "cn"
Cohesion: 0.04
Nodes (62): AccordionContent, AccordionItem, AccordionTrigger, Avatar, AvatarFallback, AvatarImage, Breadcrumb, BreadcrumbEllipsis() (+54 more)

### Community 1 - "cn"
Cohesion: 0.05
Nodes (61): AccordionContent, AccordionItem, AccordionTrigger, Avatar, AvatarFallback, AvatarImage, Breadcrumb, BreadcrumbEllipsis() (+53 more)

### Community 2 - "custom-fetch.ts"
Cohesion: 0.08
Nodes (41): ApiError, applyBaseUrl(), AuthTokenGetter, BodyType, buildErrorMessage(), customFetch(), CustomFetchOptions, ErrorType (+33 more)

### Community 3 - "labops/src/App.tsx"
Cohesion: 0.06
Nodes (27): Button(), calculateSubnet(), Card(), cls(), CONFIG_TYPES, CONFIG_VENDORS, configExplanation(), ConfigForm (+19 more)

### Community 4 - "labops/src/components/ui/sidebar.tsx"
Cohesion: 0.06
Nodes (38): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants (+30 more)

### Community 5 - "mockup-sandbox/src/components/ui/sidebar.tsx"
Cohesion: 0.06
Nodes (38): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants (+30 more)

### Community 6 - "collector.test.ts"
Cohesion: 0.10
Nodes (26): CollectorApiError, CollectorClient, CollectorJob, CollectorJobResult, Fetch, baseConfig, COLLECTOR_CAPABILITIES, COLLECTOR_PATHS (+18 more)

### Community 7 - "mockup-sandbox/src/lib/utils.ts"
Cohesion: 0.06
Nodes (23): Badge(), BadgeProps, badgeVariants, ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Checkbox (+15 more)

### Community 8 - "labops/src/lib/utils.ts"
Cohesion: 0.06
Nodes (22): Badge(), BadgeProps, badgeVariants, Checkbox, HoverCardContent, InputOTP, InputOTPGroup, InputOTPSeparator (+14 more)

### Community 9 - "devDependencies"
Cohesion: 0.06
Nodes (33): @radix-ui/react-avatar, @radix-ui/react-dialog, @radix-ui/react-hover-card, @tailwindcss/vite, @radix-ui/react-avatar, @radix-ui/react-dialog, @radix-ui/react-hover-card, @tailwindcss/vite (+25 more)

### Community 10 - "authorization.ts"
Cohesion: 0.09
Nodes (25): aggregateRouteRole(), AuthSession, AuthSessionUser, checkParameterizedPattern(), createAuthorizationMiddleware(), getMethodKey(), mapDbRoleToEnum(), Role (+17 more)

### Community 11 - "devDependencies"
Cohesion: 0.06
Nodes (33): devDependencies, clsx, cmdk, @radix-ui/react-navigation-menu, @radix-ui/react-slider, react, react-icons, @replit/vite-plugin-dev-banner (+25 more)

### Community 12 - "auth-openid-client.integration.test.ts"
Cohesion: 0.16
Nodes (11): createIssuer(), discoveryDocument(), encode(), IssuerBehavior, listen(), openServers, publicJwk, rotatedPublicJwk (+3 more)

### Community 13 - "schema/index.ts"
Cohesion: 0.09
Nodes (22): Collector, collectorsTable, collectorStatusEnum, InsertCollector, insertCollectorSchema, Device, devicesTable, InsertDevice (+14 more)

### Community 14 - "app.ts"
Cohesion: 0.15
Nodes (16): AuthDependencies, createApp(), baseConfig, request(), config, protectedRoutes, rawRequestTarget(), request() (+8 more)

### Community 15 - "monitoring.ts"
Cohesion: 0.16
Nodes (23): AvailabilityDevice, availabilityForWindow(), availabilityReport(), AvailabilitySample, incidentDurationSeconds(), createCollectorReachabilityProvider(), isDeviceInMaintenance(), isScheduledMaintenanceActive() (+15 more)

### Community 16 - "labops/src/components/ui/field.tsx"
Cohesion: 0.10
Nodes (23): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+15 more)

### Community 17 - "labops/src/hooks/use-toast.ts"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 18 - "mockup-sandbox/src/components/ui/field.tsx"
Cohesion: 0.10
Nodes (23): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+15 more)

### Community 19 - "mockup-sandbox/src/hooks/use-toast.ts"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 20 - "compilerOptions"
Cohesion: 0.08
Nodes (25): workspace, compilerOptions, alwaysStrict, customConditions, incremental, isolatedModules, lib, module (+17 more)

### Community 21 - "labops/src/components/ui/pagination.tsx"
Cohesion: 0.12
Nodes (21): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+13 more)

### Community 22 - "mockup-sandbox/src/components/ui/pagination.tsx"
Cohesion: 0.12
Nodes (21): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+13 more)

### Community 23 - "labops.ts"
Cohesion: 0.11
Nodes (14): csvCell(), toCsv(), RetentionPreviewStaleError, isIpv4OrHostname(), CONFIG_TYPES, CONFIG_VENDORS, DEVICE_TYPES, DeviceInput (+6 more)

### Community 24 - "job-leadership.ts"
Cohesion: 0.13
Nodes (15): activeLeases, DEFAULT_JOB_LEASES, forceReleaseAllLeases(), JobLease, JobLeaseConfig, JobLockKey, releaseJobLease(), requestShutdown() (+7 more)

### Community 25 - "lib/api.ts"
Cohesion: 0.11
Nodes (20): api, AvailabilityMetric, AvailabilityReport, AvailabilityReportRow, AvailabilityWindows, Device, IncidentActivity, MaintenanceHistory (+12 more)

### Community 26 - "auth-store.ts"
Cohesion: 0.16
Nodes (8): AuthStore, BootstrapIdentity, checkAuthSchemaReady(), IdentityNotProvisionedError, store, validateIdentity(), generateSessionToken(), hashOpaqueToken()

### Community 27 - "collector-jobs.ts"
Cohesion: 0.16
Nodes (17): authenticateCollector(), collectorTokenHash(), hashesEqual(), claimCollectorJob(), collectorCapabilities, CollectorJobConflictError, collectorProviderMetadata, CollectorResultInput (+9 more)

### Community 28 - "labops/src/components/ui/item.tsx"
Cohesion: 0.13
Nodes (17): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Item(), ItemActions(), ItemContent(), ItemDescription() (+9 more)

### Community 29 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, cookie-parser, cors, express, helmet, openid-client, pg, pino (+11 more)

### Community 30 - "mockupPreviewPlugin"
Cohesion: 0.14
Nodes (11): port, DiscoveredComponent, mockupPreviewPlugin(), discoverComponents(), generateSource(), getGeneratedModuleAbsPath(), getMockupsAbsDir(), isMockupFile() (+3 more)

### Community 31 - "package.json"
Cohesion: 0.11
Nodes (18): dependencies, @replit/connectors-sdk, devDependencies, prettier, typescript, license, name, private (+10 more)

### Community 32 - "auth-oidc.ts"
Cohesion: 0.10
Nodes (14): classifyOidcExchangeError(), FakeProtocol, metadata, InvalidCallbackError, loopbackHostnames, OidcMetadata, OidcProtocol, OidcService (+6 more)

### Community 33 - "auth-gate.tsx"
Cohesion: 0.23
Nodes (12): App(), AuthGate(), AuthScreen(), SessionShell(), AuthEvent, AuthState, loadSession(), performLogout() (+4 more)

### Community 34 - "mockup-sandbox/components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 35 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, esbuild, esbuild-plugin-pino, pino-pretty, thread-stream, tsx, @types/cookie-parser, @types/cors (+9 more)

### Community 36 - "lib/reachability.ts"
Cohesion: 0.17
Nodes (13): activeReachabilityProvider, checkReachability(), createLocalIcmpProvider(), execFileAsync, localIcmpProvider, performPing(), pingArguments(), PingExecutor (+5 more)

### Community 37 - "labops/components.json"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 38 - "labops/src/components/ui/command.tsx"
Cohesion: 0.12
Nodes (14): Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut() (+6 more)

### Community 39 - "mockup-sandbox/src/components/ui/command.tsx"
Cohesion: 0.12
Nodes (14): Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut() (+6 more)

### Community 40 - "metrics.ts"
Cohesion: 0.15
Nodes (8): counters, CounterValue, DEFAULT_BUCKETS, gauges, histograms, HistogramValue, Metric, metricDefs

### Community 41 - "ConfigGenerator.tsx"
Cohesion: 0.16
Nodes (9): Card(), Loading(), SavedConfiguration, cls, CONFIG_TYPES, CONFIG_VENDORS, ConfigGenerator(), FormState (+1 more)

### Community 42 - "webhook-notifications.ts"
Cohesion: 0.25
Nodes (11): attemptWebhookDelivery(), sendWebhook(), startWebhookRetries(), WebhookEvent, WebhookPayload, webhookSettings(), isAllowedWebhookUrl(), isWebhookRetryDue() (+3 more)

### Community 43 - "labops/src/components/ui/carousel.tsx"
Cohesion: 0.19
Nodes (13): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+5 more)

### Community 44 - "mockup-sandbox/src/App.tsx"
Cohesion: 0.22
Nodes (11): App(), Gallery(), getBasePath(), getPreviewExamplePath(), getPreviewPath(), ModuleMap, PreviewRenderer(), loadComponent() (+3 more)

### Community 45 - "mockup-sandbox/src/components/ui/carousel.tsx"
Cohesion: 0.19
Nodes (13): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+5 more)

### Community 46 - "saved-configurations.ts"
Cohesion: 0.40
Nodes (4): InsertSavedConfiguration, insertSavedConfigurationSchema, SavedConfiguration, savedConfigurationsTable

### Community 47 - "db/src/index.ts"
Cohesion: 0.11
Nodes (27): containsSecrets(), generateSafeConfiguration(), hasForbiddenPasswords(), redactSecrets(), validateConfigurationInput(), TEST_CREDENTIALS, createCollector(), hashToken() (+19 more)

### Community 48 - "api-client-react/package.json"
Cohesion: 0.15
Nodes (12): @tanstack/react-query, @tanstack/react-query, dependencies, @tanstack/react-query, exports, react, name, peerDependencies (+4 more)

### Community 49 - "labops/src/components/ui/input-group.tsx"
Cohesion: 0.21
Nodes (10): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea() (+2 more)

### Community 50 - "mockup-sandbox/src/components/ui/input-group.tsx"
Cohesion: 0.21
Nodes (10): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea() (+2 more)

### Community 51 - "mockup-sandbox/src/components/ui/item.tsx"
Cohesion: 0.18
Nodes (12): Item(), ItemActions(), ItemContent(), ItemDescription(), ItemFooter(), ItemGroup(), ItemHeader(), ItemMedia() (+4 more)

### Community 52 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, composite, declarationMap, emitDeclarationOnly, lib, outDir, rootDir, extends (+4 more)

### Community 53 - "api-server/src/index.ts"
Cohesion: 0.23
Nodes (9): createDefaultAuthDependencies(), main(), cleanupCollectorJobs(), runtimeConfig, startMonitoring(), ApplicationSettings, applicationSettingsTable, InsertApplicationSettings (+1 more)

### Community 54 - "health.ts"
Cohesion: 0.20
Nodes (6): router, router, router, HealthCheckResponse, ReadinessCheckResponse, HealthStatus

### Community 55 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, incremental, outDir, rootDir, tsBuildInfoFile, types, extends, include (+3 more)

### Community 56 - "error-boundary.tsx"
Cohesion: 0.21
Nodes (5): ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState, ErrorFallbackProps, toError()

### Community 57 - "labops/src/components/ui/chart.tsx"
Cohesion: 0.23
Nodes (10): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload(), THEMES (+2 more)

### Community 58 - "mockup-sandbox/src/components/ui/chart.tsx"
Cohesion: 0.23
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload(), THEMES (+2 more)

### Community 59 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, composite, declarationMap, emitDeclarationOnly, outDir, rootDir, types, extends (+3 more)

### Community 60 - "scripts/package.json"
Cohesion: 0.25
Nodes (7): name, private, scripts, hello, typecheck, type, version

### Community 61 - "api-server/package.json"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, start, test, typecheck (+2 more)

### Community 62 - "runtime-config.ts"
Cohesion: 0.25
Nodes (8): valid, bodyLimitSchema, environmentSchema, originSchema, parseOrigins(), parseRuntimeConfig(), parseTrustProxy(), authEnvironment

### Community 63 - "labops/package.json"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, serve, test, typecheck (+2 more)

### Community 64 - "setup-pdm.sh"
Cohesion: 0.44
Nodes (10): check_proxmox(), create_pbs_backup_vm(), create_pdm_vm(), download_pdm_iso(), log_error(), log_info(), log_warn(), main() (+2 more)

### Community 65 - "dependencies"
Cohesion: 0.20
Nodes (10): drizzle-orm, drizzle-zod, dependencies, drizzle-orm, drizzle-zod, pg, zod, drizzle-orm (+2 more)

### Community 66 - "devDependencies"
Cohesion: 0.20
Nodes (10): drizzle-kit, @types/pg, devDependencies, drizzle-kit, tsx, @types/node, @types/pg, drizzle-kit (+2 more)

### Community 67 - "./tsconfig.base.json"
Cohesion: 0.20
Nodes (8): extends, include, src, compileOnSave, extends, files, ./tsconfig.base.json, references

### Community 68 - "labops/tsconfig.json"
Cohesion: 0.20
Nodes (9): exclude, extends, include, build, dist, node_modules, src/**/*, **/*.test.ts (+1 more)

### Community 69 - "compilerOptions"
Cohesion: 0.20
Nodes (10): compilerOptions, allowImportingTsExtensions, jsx, moduleResolution, noEmit, paths, resolveJsonModule, types (+2 more)

### Community 70 - "mockup-sandbox/package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, preview, typecheck, type (+1 more)

### Community 71 - "mockup-sandbox/tsconfig.json"
Cohesion: 0.20
Nodes (9): exclude, extends, include, build, dist, src/**/*, **/*.test.ts, mockupPreviewPlugin.ts (+1 more)

### Community 72 - "compilerOptions"
Cohesion: 0.20
Nodes (10): compilerOptions, allowImportingTsExtensions, esModuleInterop, incremental, jsx, noEmit, paths, tsBuildInfoFile (+2 more)

### Community 73 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, declarationMap, emitDeclarationOnly, outDir, rootDir, extends, include (+1 more)

### Community 74 - "labops/src/components/ui/card.tsx"
Cohesion: 0.28
Nodes (7): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, NotFound()

### Community 75 - "mockup-sandbox/src/components/ui/table.tsx"
Cohesion: 0.22
Nodes (8): Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow

### Community 76 - "api-spec/package.json"
Cohesion: 0.22
Nodes (8): devDependencies, orval, name, private, scripts, codegen, version, orval

### Community 77 - "api-zod/package.json"
Cohesion: 0.22
Nodes (8): dependencies, zod, exports, zod, name, private, type, version

### Community 78 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, collectors, db:migrate, db:migrate:status, db:push, migrate, migrate:status, push (+1 more)

### Community 79 - "auth.ts"
Cohesion: 0.39
Nodes (8): cookiePolicy(), AuthRouteDependencies, callbackUrlFromRequest(), createAuthRouter(), createMainAuthGuard(), noStore(), sendUnavailable(), SessionResult

### Community 80 - "scripts/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, types, extends, include, node, src

### Community 81 - "@types/node"
Cohesion: 0.25
Nodes (8): @types/node, @types/node, @types/node, @types/node, devDependencies, tsx, @types/node, tsx

### Community 82 - "csrf.ts"
Cohesion: 0.33
Nodes (4): CsrfToken, csrfTokens, generateCsrfToken(), registerCsrfToken()

### Community 83 - "rate-limiter.ts"
Cohesion: 0.39
Nodes (7): cleanupRateLimits(), createGlobalRateLimiter(), createRateLimitMiddleware(), getRateLimitKey(), RateLimitEntry, RateLimitOptions, rateLimitStore

### Community 84 - "labops/src/components/ui/drawer.tsx"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 85 - "labops/src/components/ui/empty.tsx"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 86 - "labops/src/components/ui/navigation-menu.tsx"
Cohesion: 0.29
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 87 - "mockup-sandbox/src/components/ui/empty.tsx"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 88 - "mockup-sandbox/src/components/ui/navigation-menu.tsx"
Cohesion: 0.29
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 89 - "mockup-sandbox/src/components/ui/select.tsx"
Cohesion: 0.25
Nodes (7): SelectContent, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger

### Community 90 - "rate-limit.ts"
Cohesion: 0.38
Nodes (6): createEndpointRateLimiter(), createRateLimitMiddleware(), generateRateLimitKey(), RateLimitConfig, RateLimitEntry, rateLimitStore

### Community 91 - "collector/package.json"
Cohesion: 0.18
Nodes (10): bin, labops-collector, devDependencies, tsx, @types/node, tsx, name, private (+2 more)

### Community 92 - "compilerOptions"
Cohesion: 0.29
Nodes (7): compilerOptions, incremental, outDir, rootDir, tsBuildInfoFile, types, node

### Community 93 - "labops/src/components/ui/toggle-group.tsx"
Cohesion: 0.43
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 94 - "lib"
Cohesion: 0.29
Nodes (7): lib, dom, dom.iterable, lib, dom, es2022, esnext

### Community 95 - "mockup-sandbox/src/components/ui/toggle-group.tsx"
Cohesion: 0.43
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 96 - "db/package.json"
Cohesion: 0.29
Nodes (6): exports, ./schema, name, private, type, version

### Community 97 - "@radix-ui/react-separator"
Cohesion: 0.67
Nodes (3): @radix-ui/react-separator, @radix-ui/react-separator, @radix-ui/react-separator

### Community 99 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 100 - "isDeviceInMaintenance"
Cohesion: 0.40
Nodes (6): DeviceDetail(), isDeviceInMaintenance(), isScheduledMaintenanceActive(), maintenanceSummary(), maintenanceWindow(), Monitoring()

### Community 101 - "labops/src/components/ui/alert.tsx"
Cohesion: 0.50
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 102 - "mockup-sandbox/src/components/ui/alert.tsx"
Cohesion: 0.50
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 103 - "orval.config.ts"
Cohesion: 0.40
Nodes (3): apiClientReactSrc, apiZodSrc, root

### Community 105 - "class-variance-authority"
Cohesion: 0.67
Nodes (3): class-variance-authority, class-variance-authority, class-variance-authority

### Community 106 - "date-fns"
Cohesion: 0.67
Nodes (3): date-fns, date-fns, date-fns

### Community 107 - "embla-carousel-react"
Cohesion: 0.67
Nodes (3): embla-carousel-react, embla-carousel-react, embla-carousel-react

### Community 108 - "framer-motion"
Cohesion: 0.67
Nodes (3): framer-motion, framer-motion, framer-motion

### Community 109 - "@hookform/resolvers"
Cohesion: 0.67
Nodes (3): @hookform/resolvers, @hookform/resolvers, @hookform/resolvers

### Community 110 - "input-otp"
Cohesion: 0.67
Nodes (3): input-otp, input-otp, input-otp

### Community 111 - "lucide-react"
Cohesion: 0.67
Nodes (3): lucide-react, lucide-react, lucide-react

### Community 112 - "next-themes"
Cohesion: 0.67
Nodes (3): next-themes, next-themes, next-themes

### Community 113 - "@radix-ui/react-accordion"
Cohesion: 0.67
Nodes (3): @radix-ui/react-accordion, @radix-ui/react-accordion, @radix-ui/react-accordion

### Community 114 - "@radix-ui/react-alert-dialog"
Cohesion: 0.67
Nodes (3): @radix-ui/react-alert-dialog, @radix-ui/react-alert-dialog, @radix-ui/react-alert-dialog

### Community 115 - "@radix-ui/react-aspect-ratio"
Cohesion: 0.67
Nodes (3): @radix-ui/react-aspect-ratio, @radix-ui/react-aspect-ratio, @radix-ui/react-aspect-ratio

### Community 116 - "@radix-ui/react-tabs"
Cohesion: 0.67
Nodes (3): @radix-ui/react-tabs, @radix-ui/react-tabs, @radix-ui/react-tabs

### Community 117 - "@radix-ui/react-checkbox"
Cohesion: 0.67
Nodes (3): @radix-ui/react-checkbox, @radix-ui/react-checkbox, @radix-ui/react-checkbox

### Community 118 - "@radix-ui/react-collapsible"
Cohesion: 0.67
Nodes (3): @radix-ui/react-collapsible, @radix-ui/react-collapsible, @radix-ui/react-collapsible

### Community 119 - "@radix-ui/react-context-menu"
Cohesion: 0.67
Nodes (3): @radix-ui/react-context-menu, @radix-ui/react-context-menu, @radix-ui/react-context-menu

### Community 120 - "react-dom"
Cohesion: 0.67
Nodes (3): react-dom, react-dom, react-dom

### Community 121 - "@radix-ui/react-dropdown-menu"
Cohesion: 0.67
Nodes (3): @radix-ui/react-dropdown-menu, @radix-ui/react-dropdown-menu, @radix-ui/react-dropdown-menu

### Community 122 - "@replit/vite-plugin-cartographer"
Cohesion: 0.67
Nodes (3): @replit/vite-plugin-cartographer, @replit/vite-plugin-cartographer, @replit/vite-plugin-cartographer

### Community 123 - "@radix-ui/react-label"
Cohesion: 0.67
Nodes (3): @radix-ui/react-label, @radix-ui/react-label, @radix-ui/react-label

### Community 124 - "@radix-ui/react-menubar"
Cohesion: 0.67
Nodes (3): @radix-ui/react-menubar, @radix-ui/react-menubar, @radix-ui/react-menubar

### Community 125 - "@types/react"
Cohesion: 0.67
Nodes (3): @types/react, @types/react, @types/react

### Community 126 - "@radix-ui/react-popover"
Cohesion: 0.67
Nodes (3): @radix-ui/react-popover, @radix-ui/react-popover, @radix-ui/react-popover

### Community 127 - "@radix-ui/react-progress"
Cohesion: 0.67
Nodes (3): @radix-ui/react-progress, @radix-ui/react-progress, @radix-ui/react-progress

### Community 128 - "@radix-ui/react-radio-group"
Cohesion: 0.67
Nodes (3): @radix-ui/react-radio-group, @radix-ui/react-radio-group, @radix-ui/react-radio-group

### Community 129 - "@radix-ui/react-scroll-area"
Cohesion: 0.67
Nodes (3): @radix-ui/react-scroll-area, @radix-ui/react-scroll-area, @radix-ui/react-scroll-area

### Community 130 - "@radix-ui/react-select"
Cohesion: 0.67
Nodes (3): @radix-ui/react-select, @radix-ui/react-select, @radix-ui/react-select

### Community 131 - "@types/react-dom"
Cohesion: 0.67
Nodes (3): @types/react-dom, @types/react-dom, @types/react-dom

### Community 132 - "@radix-ui/react-slot"
Cohesion: 0.67
Nodes (3): @radix-ui/react-slot, @radix-ui/react-slot, @radix-ui/react-slot

### Community 133 - "@radix-ui/react-switch"
Cohesion: 0.67
Nodes (3): @radix-ui/react-switch, @radix-ui/react-switch, @radix-ui/react-switch

### Community 134 - "@radix-ui/react-toast"
Cohesion: 0.67
Nodes (3): @radix-ui/react-toast, @radix-ui/react-toast, @radix-ui/react-toast

### Community 135 - "@radix-ui/react-toggle"
Cohesion: 0.67
Nodes (3): @radix-ui/react-toggle, @radix-ui/react-toggle, @radix-ui/react-toggle

### Community 136 - "@radix-ui/react-toggle-group"
Cohesion: 0.67
Nodes (3): @radix-ui/react-toggle-group, @radix-ui/react-toggle-group, @radix-ui/react-toggle-group

### Community 137 - "@radix-ui/react-tooltip"
Cohesion: 0.67
Nodes (3): @radix-ui/react-tooltip, @radix-ui/react-tooltip, @radix-ui/react-tooltip

### Community 138 - "react-day-picker"
Cohesion: 0.67
Nodes (3): react-day-picker, react-day-picker, react-day-picker

### Community 139 - "react-hook-form"
Cohesion: 0.67
Nodes (3): react-hook-form, react-hook-form, react-hook-form

### Community 140 - "react-resizable-panels"
Cohesion: 0.67
Nodes (3): react-resizable-panels, react-resizable-panels, react-resizable-panels

### Community 141 - "recharts"
Cohesion: 0.67
Nodes (3): recharts, recharts, recharts

### Community 142 - "@replit/vite-plugin-runtime-error-modal"
Cohesion: 0.67
Nodes (3): @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-runtime-error-modal

### Community 143 - "tailwind-merge"
Cohesion: 0.67
Nodes (3): tailwind-merge, tailwind-merge, tailwind-merge

### Community 144 - "tailwindcss"
Cohesion: 0.67
Nodes (3): tailwindcss, tailwindcss, tailwindcss

### Community 145 - "tw-animate-css"
Cohesion: 0.67
Nodes (3): tw-animate-css, tw-animate-css, tw-animate-css

### Community 146 - "@vitejs/plugin-react"
Cohesion: 0.67
Nodes (3): @vitejs/plugin-react, @vitejs/plugin-react, @vitejs/plugin-react

## Knowledge Gaps
- **483 isolated node(s):** `AuthSession`, `AuthSessionUser`, `RouteAccessRequirement`, `AuthSession`, `OidcAuthFlow` (+478 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `mockup-sandbox/src/components/ui/sidebar.tsx`, `mockup-sandbox/src/components/ui/alert.tsx`, `mockup-sandbox/src/lib/utils.ts`, `mockup-sandbox/src/components/ui/command.tsx`, `mockup-sandbox/src/components/ui/table.tsx`, `mockup-sandbox/src/components/ui/carousel.tsx`, `mockup-sandbox/src/components/ui/field.tsx`, `mockup-sandbox/src/components/ui/input-group.tsx`, `mockup-sandbox/src/components/ui/item.tsx`, `mockup-sandbox/src/hooks/use-toast.ts`, `mockup-sandbox/src/components/ui/pagination.tsx`, `mockup-sandbox/src/components/ui/empty.tsx`, `mockup-sandbox/src/components/ui/navigation-menu.tsx`, `mockup-sandbox/src/components/ui/select.tsx`, `mockup-sandbox/src/components/ui/chart.tsx`, `mockup-sandbox/src/components/ui/toggle-group.tsx`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `labops/src/components/ui/sidebar.tsx`, `labops/src/components/ui/alert.tsx`, `labops/src/components/ui/command.tsx`, `labops/src/lib/utils.ts`, `labops/src/components/ui/card.tsx`, `labops/src/components/ui/carousel.tsx`, `labops/src/components/ui/field.tsx`, `labops/src/components/ui/input-group.tsx`, `labops/src/hooks/use-toast.ts`, `labops/src/components/ui/drawer.tsx`, `labops/src/components/ui/pagination.tsx`, `labops/src/components/ui/empty.tsx`, `labops/src/components/ui/navigation-menu.tsx`, `labops/src/components/ui/chart.tsx`, `labops/src/components/ui/item.tsx`, `labops/src/components/ui/toggle-group.tsx`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `@types/node` connect `@types/node` to `devDependencies`, `collector/package.json`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `AuthSession`, `AuthSessionUser`, `RouteAccessRequirement` to the rest of the system?**
  _483 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.044790652385589096 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.04792792792792793 - nodes in this community are weakly interconnected._
- **Should `custom-fetch.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08048103607770583 - nodes in this community are weakly interconnected._