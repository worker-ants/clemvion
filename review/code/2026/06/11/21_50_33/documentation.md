# Documentation Review

## 발견사항

### 파일 1: audit-action.const.ts

- **[INFO]** 모듈 JSDoc 업데이트 완료 — 명명 규약 예시에 `auth_config` 동사 시제(현재형)가 정확히 반영됨
  - 위치: 파일 헤더 JSDoc, 라인 35–37
  - 상세: `auth_config 은 CRUD 동사 현재형 \`create\`/\`update\`/\`delete\`/\`regenerate\`/\`reveal\`` 추가로 integration(과거분사) vs auth_config(현재형) 시제 차이가 명시적으로 기술됨. 의도적 불일치 이유가 문서화됨.
  - 제안: 이상 없음. 단, 향후 신규 리소스 추가 시 이 규약 예시도 갱신해야 함을 팀 내 인지 필요.

- **[INFO]** 새 4개 상수(`AUTH_CONFIG_CREATE/UPDATE/DELETE/REGENERATE`) 추가 — 인라인 주석 없으나 모듈 JSDoc이 목적을 설명
  - 위치: 라인 45–48
  - 상세: 상수 자체는 자명(self-documenting)하며 명명 규약이 상위 JSDoc에 기술됨. 추가 인라인 주석 불필요.
  - 제안: 이상 없음.

---

### 파일 2: auth-configs.controller.ts

- **[INFO]** 4개 핸들러 공통 패턴을 `create` 핸들러에만 인라인 주석으로 설명
  - 위치: 라인 268–269 (`// userId(@CurrentUser sub) + req.ip — CRUD 감사 로그(auth_config.*)의 주체·IP 기록용. // 4개 변경 핸들러(create/update/regenerate/remove) 공통 패턴.`)
  - 상세: `update`, `regenerate`, `remove` 핸들러에는 동일 설명이 없음. `create` 의 주석이 "4개 공통 패턴"으로 명시하므로 다른 핸들러에서 반복 주석은 불필요하다. 일관성 관점에서 적절한 선택.
  - 제안: 이상 없음.

- **[INFO]** Swagger `@ApiForbiddenResponse` 설명에 `remove` 핸들러는 "Editor 미만 권한"으로 표기되어 있으나 `@Roles('admin')` 으로 제한됨
  - 위치: 라인 389 (`@ApiForbiddenResponse({ description: 'Editor 미만 권한' })`)
  - 상세: `@Delete(':id')` 는 `@Roles('admin')` 이므로 실제로는 Admin 미만이 forbidden이다. "Editor 미만" 표기는 기존 버그이며 본 PR 변경사항과 무관하게 존재. 이번 변경으로 새롭게 도입된 문제는 아님.
  - 제안: (기존 버그) `'Admin 미만 권한'` 으로 수정 권장. 현재 PR scope 외 이슈로 별도 follow-up 가능.

---

### 파일 3: auth-configs.service.spec.ts

- **[INFO]** `reveal` 실패 테스트에 `audit.record.mockClear()` 이유 설명 인라인 주석 추가됨
  - 위치: 라인 1385–1387
  - 상세: `// create 단계의 auth_config.create 기록을 제거 — 이 테스트는 reveal 실패가 auth_config.reveal 을 기록하지 않음만 검증한다.` — 테스트 의도가 명확히 서술됨. 우수한 인라인 문서화.
  - 제안: 이상 없음.

- **[INFO]** 새 describe 블록 `'CRUD audit 기록 (spec/5-system/1-auth.md §4.1)'` 에 스펙 참조 링크 포함
  - 위치: 라인 934
  - 상세: 테스트 목적과 스펙 근거가 describe 이름에 명시됨. spec 경로 직접 기재로 추적성 높음.
  - 제안: 이상 없음.

---

### 파일 4: auth-configs.service.ts

- **[INFO]** `create` 메서드에 완전한 JSDoc 추가됨
  - 위치: 라인 1638–1645
  - 상세: `@param userId`, `@param ipAddress`, `@remarks` (best-effort 계약, swallow 정책, 타 메서드와의 패턴 동일성) 모두 기술됨. 특히 감사 장애가 CRUD를 롤백하지 않는다는 계약이 명시돼 있어 향후 유지보수자에게 명확한 가이드.
  - 제안: 이상 없음.

- **[INFO]** `update`, `regenerate`, `remove` 메서드는 단행 JSDoc으로 `{@link create}` 참조 처리
  - 위치: 라인 1688, 1710, 1742
  - 상세: `/** 수정 후 \`auth_config.update\` 감사 기록. userId/ipAddress·best-effort 계약은 {@link create} 참조. */` 패턴. `create` 의 상세 JSDoc을 DRY 하게 재사용함. VSCode/TypeDoc에서 링크 추적 가능.
  - 제안: 이상 없음.

- **[WARNING]** `update` 메서드 JSDoc에 `@param userId`, `@param ipAddress` 누락 — `create` 와 달리 파라미터 설명 없음
  - 위치: 라인 1688 (`/** 수정 후 ... {@link create} 참조. */`)
  - 상세: `create` 는 `@param` 태그로 각 신규 파라미터를 기술했지만 `update`/`regenerate`/`remove` 는 단행 JSDoc만 있어 자동 문서화 도구(TypeDoc)에서 파라미터 설명이 누락됨. `{@link create}` 참조로 계약을 간접 전달하고 있어 실용적 영향은 낮으나, 일관성 측면에서 개선 여지가 있음.
  - 제안: `{@link create}` 참조만으로 충분하다고 판단되면 유지. 파라미터 설명을 원하면 `@param userId - {@link create} 참조` 형식 추가.

---

### 파일 5: plan/in-progress/auth-config-webhook-followups.md

- **[INFO]** 진행 상황 blockquote가 체크리스트 형식으로 상세 기술됨
  - 위치: 라인 12–21
  - 상세: 완료 항목(`[x]`)과 미완료 항목(`[ ]`)이 명확히 구분됨. spec 동기화(`spec §4.1 4종 Planned→구현됨 이동 + data-flow §1.1 writer 표 동기화`) 항목도 포함됨.
  - 제안: 이상 없음.

- **[INFO]** frontmatter `worktree` 필드가 `(unstarted)` → 실제 경로와 브랜치명으로 갱신됨
  - 위치: 라인 2–4
  - 상세: 작업 추적에 필요한 메타데이터가 정확히 갱신됨.
  - 제안: 이상 없음.

---

### 파일 6: spec/5-system/1-auth.md

- **[INFO]** §4.1 "현재 구현된 액션" 표의 설정 행이 1종 → 5종으로 정확히 갱신됨
  - 위치: 라인 2555
  - 상세: `auth_config.reveal` 단독에서 `auth_config.create, auth_config.update, auth_config.delete, auth_config.regenerate, auth_config.reveal` 으로 확장. 구현 사실과 일치.
  - 제안: 이상 없음.

- **[INFO]** §4.1 "Planned" 표에서 `auth_config.create/update/delete/regenerate` 4종 제거됨
  - 위치: 라인 2567
  - 상세: 구현 완료된 항목이 Planned 표에서 삭제되어 이중 기재 없음. 단일 진실 원칙 유지.
  - 제안: 이상 없음.

---

### 파일 7: spec/data-flow/1-audit.md

- **[INFO]** §1.1 writer 표에 auth-configs 5종 행 추가 및 기존 `reveal` 행 비고 갱신
  - 위치: 라인 2872–2876
  - 상세: `auth_config.reveal` 의 비고가 `유일하게 \`ipAddress\` 를 함께 전달` 에서 `평문 노출 (비밀번호 재확인). auth_config 계열은 모두 \`ipAddress\` 를 함께 전달` 로 갱신됨. 5개 action 모두 ipAddress를 전달한다는 사실이 정확히 반영됨.
  - 제안: 이상 없음.

- **[INFO]** Mermaid 다이어그램 내 Writer Service 참여자 설명에 `auth-configs` 는 이미 포함됨
  - 위치: 라인 2852
  - 상세: `participant Caller as Writer Service<br/>(integrations·workspaces·executions·auth-configs)` — 기존에 이미 나열됨. 다이어그램 별도 수정 불필요.
  - 제안: 이상 없음.

---

## 요약

이번 변경의 문서화 품질은 전반적으로 높다. `audit-action.const.ts` 모듈 JSDoc이 도메인별 시제 차이를 명시적으로 서술하고, `auth-configs.service.ts` 의 신규 메서드에 best-effort 계약과 `{@link}` 참조가 일관되게 적용됐다. spec(`1-auth.md §4.1`)과 data-flow(`1-audit.md §1.1`) 두 문서 모두 구현 사실에 맞게 동기화됐으며, plan 파일의 체크리스트와 frontmatter도 정확히 갱신됐다. 유일한 개선 여지는 (a) `update`/`regenerate`/`remove` JSDoc에 `@param` 태그 미기재(실용 영향 낮음, WARNING 수준)와 (b) `remove` 핸들러 Swagger `@ApiForbiddenResponse` 설명의 역할 표기 오류(기존 버그, 현 PR 도입 아님)이며, 두 항목 모두 문서화 기능 결함보다는 정밀도 개선 수준이다.

## 위험도

LOW
