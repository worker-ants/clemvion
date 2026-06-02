# 정식 규약 준수 검토 — `plan/in-progress/system-status-page.md`

검토 모드: spec draft (--spec)
검토 대상: plan 문서 내 spec draft A~E

---

## 발견사항

### [WARNING] Spec A frontmatter `status` 값이 규약 enum 에 없음
- target 위치: Section A `spec/5-system/16-system-status.md` frontmatter — `status: planned`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status` 허용값은 `backlog | spec-only | partial | implemented | archived` 다섯 가지
- 상세: `planned` 는 `spec/conventions/spec-impl-evidence.md` 의 라이프사이클 enum 에 존재하지 않는다. `spec/conventions/cafe24-api-catalog/_overview.md §3` 의 Cafe24 endpoint 카탈로그 전용 값(`planned`)과 혼용됐다.
- 제안: `status: spec-only` 로 교정. 신규 spec 으로 구현 의도가 확정됐고 코드가 아직 없는 상태이므로 `spec-only` 가 적합하다.

### [WARNING] Spec B frontmatter `status` 값이 규약 enum 에 없음
- target 위치: Section B `spec/2-navigation/15-system-status.md` frontmatter — `status: planned`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` (동일)
- 상세: Spec A 와 동일 원인.
- 제안: `status: spec-only` 로 교정.

### [WARNING] Spec A `code:` 경로와 `status` 조합 — build-time 가드 fail 위험
- target 위치: Section A frontmatter — `code: - codebase/backend/src/modules/queue-monitor/**`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `spec-only` 는 `code:` 가 비어도 OK. `partial`·`implemented` 는 ≥1 매치 의무.
- 상세: spec draft 단계에서 아직 존재하지 않는 경로를 `code:` 에 지정하면, `status` 가 `partial` 또는 `implemented` 로 분류될 경우 `spec-code-paths.test.ts` 가드가 파일 미존재로 fail 한다. `spec-only` 로 교정해도 경로를 남겨두면 향후 상태 승격 시 자동 유효성 검사 대상이 된다.
- 제안: `status: spec-only` 와 함께 `code: []` 로 두고, 첫 코드 머지 시 `partial` 로 승격하며 실제 경로를 채운다.

### [WARNING] Spec B `code:` 경로와 `status` 조합 — build-time 가드 fail 위험
- target 위치: Section B frontmatter — `code: - codebase/frontend/src/app/(main)/queue-monitor/page.tsx`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` (동일)
- 상세: Spec A 와 동일 원인.
- 제안: `code: []` 로 두고 첫 머지 시 승격.

### [WARNING] Spec A `id` 와 파일명 basename 불일치
- target 위치: Section A frontmatter — `id: system-status`, 파일명 `16-system-status.md`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "`id`: 파일 basename(확장자 제외) 기반 권장"
- 상세: 파일명 basename 은 `16-system-status` 이나 `id` 는 `system-status`. 규약이 "권장"이므로 CRITICAL 은 아니나, `spec-frontmatter.test.ts` 가 basename 매칭을 강제하면 fail 이 발생할 수 있다. 기존 spec 파일들(`id: api-convention` ↔ `2-api-convention.md`)을 보면 번호 prefix 를 id 에서 제외하는 관행이 확인되므로 `system-status` 는 허용 범위 내일 수 있다. 다만 테스트 구현 확인 후 결정 권장.
- 제안: 기존 파일들의 id 패턴 (`id: api-convention`, `id: error-codes` 등)이 prefix 제외 관행이라면 `system-status` 유지 가능. 가드 동작을 확인 후 결정.

### [WARNING] Spec B `id` 가 파일명 및 Spec A 와 혼동 가능
- target 위치: Section B frontmatter — `id: system-status-page`, 파일명 `15-system-status.md`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` (동일)
- 상세: `id: system-status-page` 인데 파일명 basename 에 `-page` 가 없다. Spec A 의 `id: system-status` 와도 패턴이 불일치한다. `-page` suffix 추가가 의도적(backend spec 과 구분)이라면 이해할 수 있으나, 파일명에도 suffix 를 반영하거나 id 에서 제거해야 일관성이 유지된다.
- 제안: `id: system-status-page` → `id: system-status` 또는 파일명을 `15-system-status-page.md` 로 변경. 단, `spec-frontmatter.test.ts` 가드 동작 확인 필요.

### [INFO] Spec A §2 API endpoint 경로에 `/api/` prefix 누락
- target 위치: Section A §2 — `GET /queue-monitor/overview`
- 위반 규약: `spec/5-system/2-api-convention.md §2.1` — 기본 패턴 `{base_url}/api/{resource}`
- 상세: 명세 내 경로가 `/queue-monitor/overview` 로 `/api/` prefix 가 없다. spec 내 설명 약칭인지 실제 경로인지 모호. 구현 시 `/api/queue-monitor/overview` 로 맞춰야 하므로 spec 에서도 명시하는 것이 좋다.
- 제안: `GET /api/queue-monitor/overview` 로 명시하거나 약칭임을 주석으로 표기.

### [INFO] Spec B §2.4 폴링 간격 근사 표기
- target 위치: Section B §2.4 — "`refetchInterval` ~5초 폴링"
- 위반 규약: 명시적 금지 사항 없음.
- 상세: `~5초` 는 구현 시 해석 여지를 남긴다.
- 제안: `refetchInterval: 5000ms` 로 명시.

---

## 요약

target spec draft 의 정식 규약 준수 관점 평가: 가장 중요한 위반은 Spec A·B 의 frontmatter `status: planned` 가 `spec/conventions/spec-impl-evidence.md §3` 의 라이프사이클 enum 에 없는 값이라는 점이다. 이대로 spec 파일이 생성되면 `spec-frontmatter.test.ts` build-time 가드가 fail 할 가능성이 높다. `code:` 경로에 미존재 파일을 지정한 것도 상태 승격 시 가드 충돌 위험이 있다. `id` 와 파일명 불일치는 기존 관행(번호 prefix 제외)과 부합할 수 있으나 Spec B 의 `-page` suffix 는 불일치 소지가 있어 확인 필요. 나머지는 형식·명확성 개선 제안 수준으로 구현 차단은 아니다. spec 파일 반영 전 `status: spec-only` 교정과 `code: []` 처리를 먼저 수행해야 한다.

---

## 위험도

MEDIUM
