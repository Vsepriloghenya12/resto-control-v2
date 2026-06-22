# Zone Readiness Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить рядом с donut-графиком компактный интерактивный график готовности зон на существующих данных `model.zones`.

**Architecture:** Добавить отдельный React-компонент внутри `OwnerDashboardPage.tsx` и встроить его в `OperationalDonutWidget`. Стили изолировать классами `owner-zone-readiness-*`; существующую модель данных и API не менять.

**Tech Stack:** React 19, TypeScript, CSS, Node test runner.

---

### Task 1: Зафиксировать формат отображаемых зон

**Files:**
- Create: `tests/zone-readiness.test.mjs`
- Create: `src/pages/owner-dashboard/zoneReadiness.js`
- Create: `src/pages/owner-dashboard/zoneReadiness.d.ts`

- [ ] **Step 1: Write the failing test**

Проверить ограничение в пять строк, сохранение порядка и корректный empty-state.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/zone-readiness.test.mjs`

Expected: FAIL because `prepareZoneReadiness` is missing.

- [ ] **Step 3: Write minimal implementation**

Реализовать `prepareZoneReadiness(zones)`, возвращающий первые пять зон и флаг пустого состояния.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/zone-readiness.test.mjs`

Expected: PASS.

### Task 2: Добавить график в текущий виджет

**Files:**
- Modify: `src/pages/owner-dashboard/OwnerDashboardPage.tsx`
- Modify: `src/pages/owner-dashboard/OwnerDashboardPage.css`

- [ ] **Step 1: Add `ZoneReadinessChart`**

Отрисовать до пяти кнопок со шкалой, значениями и переходом в `checklists`.

- [ ] **Step 2: Preserve donut behavior**

Оставить вычисление сегментов, hover/focus, центр и переходы без изменений.

- [ ] **Step 3: Add responsive layout**

На desktop разместить donut-блок и зоны рядом; до `920px` переносить зоны ниже.

### Task 3: Verification

**Files:**
- Verify: `tests/zone-readiness.test.mjs`
- Verify: `tests/donut-geometry.test.mjs`

- [ ] **Step 1:** Run `node --test tests/zone-readiness.test.mjs tests/donut-geometry.test.mjs`
- [ ] **Step 2:** Run `npx tsc --noEmit`
- [ ] **Step 3:** Run `npx vite build`
- [ ] **Step 4:** Browser-check desktop and narrow viewport, including click navigation and empty-state.
