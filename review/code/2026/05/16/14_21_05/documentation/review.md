# 문서화(Documentation) Review

리뷰 대상: cafe24-hmac-raw-fix-b8e2d1 worktree 변경 세트 (2026-05-16)

주요 변경 파일:
- `spec/4-nodes/4-integration/4-cafe24.md` — §9.8 HMAC 알고리즘 재정정, §9.9 재작성, CHANGELOG 추가
- `spec/2-navigation/4-integration.md` — §4.2 App URL 카드 추가, API 표 갱신, Rationale 2항 신설
- `spec/1-data-model.md` — `install_token` / `install_token_issued_at` 컬럼 설명 정정
- `spec/data-flow/5-integration.md` — sequence diagram callback 성공 분기 정정
- `review/consistency/` — 다수 세션 보고서 신규 생성 (문서화 산출물)

---

### 발견사항

- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md` §9.8 코드 예시 — `verifyHmac` 함수 패턴이 실제 구현과 불일치
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 코드 블록 (`verifyHmac` 함수)
  - 상세: spec 의 `verifyHmac(rawQuery, clientSecret, receivedHmac)` 예시는 내부에서 `buildHmacMessage` 를 호출하는 단일 함수 패턴이다. 그러나 실제 backend 구현은 `buildHmacMessage` + `verifyHmacWithMessage` 로 분리된 패턴이며, `tryRecoverByMallId` 가 `buildHmacMessage` 를 한 번 호출한 뒤 후보별로 `verifyHmacWithMessage` 를 재사용한다. spec 코드 예시가 구현 패턴과 다르면 이후 개발자가 spec 을 참조할 때 혼동할 수 있다.
  - 제안: spec §9.8 코드 예시를 `buildHmacMessage` + `verifyHmacWithMessage` 분리 패턴에 맞춰 조정하거나, 예시 상단에 "개념 설명용 — 실제 구현은 `buildHmacMessage` / `verifyHmacWithMessage` 분리 패턴" 임을 주석으로 명시한다.

- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md` §10 CHANGELOG — `11_11_07` 세션 경로 참조 오기
  - 위치: §10 CHANGELOG 표의 `2026-05-16` 행 말미 — `consistency-check 세션: review/consistency/2026/05/16/11_11_07/ (Critical 0)`
  - 상세: 해당 경로가 파일시스템에 존재하지 않는다. convention_compliance 체커가 2026-05-16 날짜의 실제 세션 목록을 확인한 결과 `11_11_07` 이 없고 인접 시각인 `11_43_07` 이 존재한다. CHANGELOG 에 "(Critical 0)" 결과까지 기술되어 있어 오타 혹은 존재하지 않는 세션을 참조한 오기인지 불명확하다.
  - 제안: 올바른 세션 타임스탬프(`11_43_07` 또는 다른 실제 존재 경로)로 정정하거나, 해당 세션이 실행되지 않은 경우 참조 구문을 제거한다.

- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md` §9.9 — (A)/(B) 옵션 기호 재정의로 인한 이력 추적 혼동 위험
  - 위치: §9.9 "Fields 편집 UI — 메타데이터 기반 typed 동적 폼"
  - 상세: 옛 §9.9 (PR #77) 는 `(A) config.fields 직접 사용` / `(B) Array<{key,value}> 내부 버퍼` 를 정의했다. 새 §9.9 는 동일 기호 (A)/(B) 를 전혀 다른 의미(`(A) 자유 key/value 행 입력` / `(B) 메타데이터 기반 동적 폼`)로 재정의한다. CHANGELOG 와 `plan/complete/spec-update-cafe24-fields-ui-buffer.md` 에서 옛 §9.9 의 B 채택을 참조하는 독자가 혼동할 수 있다.
  - 제안: §9.9 도입부에 "(본 절의 (A)/(B) 는 PR #77 원문의 옵션 기호와 무관한 새 비교 축이다)" 안내를 한 줄 추가한다.

- **[WARNING]** `review/consistency/2026/05/16/13_29_47/convention_compliance/review.md` — `spec_files` frontmatter 키가 CLAUDE.md 공식 스키마 외 확장 키임을 지적하지만 CLAUDE.md 자체에 반영되지 않음
  - 위치: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` frontmatter `spec_files:` 블록
  - 상세: convention_compliance 체커가 `spec_files` 키를 "공식 frontmatter 스키마(`worktree`, `started`, `owner`) 외 확장 키" 라고 지적했다. 이 패턴이 이번 PR 에서 도입되었으나 CLAUDE.md 의 plan frontmatter 규약에 해당 키가 추가되지 않아 다음 사람이 같은 패턴을 사용할 때 동일한 WARNING 이 반복된다.
  - 제안: `spec_files` 를 정식 frontmatter 키로 CLAUDE.md 에 추가하거나, 본문 내 별도 섹션으로 이동해 frontmatter 를 공식 3키로 유지한다.

- **[INFO]** `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" — `tryRecoverByMallId` 와 HMAC raw 보존 알고리즘의 연계 미명시
  - 위치: `spec/2-navigation/4-integration.md` Rationale "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 항
  - 상세: `buildHmacMessage` 함수 변경이 `handleInstall` 뿐 아니라 `tryRecoverByMallId` 의 HMAC trial 검증에도 자동으로 적용되는 구조임(함수 공유)이 spec 에 명시되어 있지 않다. 이 연계를 모르는 유지보수 담당자가 `tryRecoverByMallId` 만 별도로 다른 알고리즘을 사용한다고 오해할 수 있다.
  - 제안: Rationale 신규 항 또는 기존 "Cafe24 install_token mismatch 회복 흐름 — 보안 전제" 항에 "본 알고리즘 재정정이 회복 분기(`tryRecoverByMallId`) 에도 동일하게 적용됨 — `buildHmacMessage` 함수 공유 구조" 한 줄 추가.

- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md` §9.9 — "옛 패턴은 본 프로젝트에서 더 이상 사용되지 않는다" 문장의 범위 불명확
  - 위치: §9.9 "적용 범위 변경 (2026-05-16)" 단락
  - 상세: "옛 'object-shaped contract + 편집 버퍼' 패턴은 본 프로젝트에서 더 이상 사용되지 않는다" 문장이 cafe24 노드에만 한정되는지 프로젝트 전체에서 선언하는 것인지 독자에 따라 해석이 갈릴 수 있다. `http_request` 의 `headers`/`queryParams` 는 `KeyValue[]` 배열 직렬화로서 처음부터 해당 없다는 사실이 누락되어 있다.
  - 제안: 해당 문장 뒤에 "(다른 통합 노드의 `headers`/`queryParams` 는 `KeyValue[]` 배열 직렬화로 처음부터 해당 없음)" 보충을 소괄호로 추가한다.

- **[INFO]** `spec/2-navigation/4-integration.md` — `IntegrationDto.appUrl` 필드 신규 추가에 대한 Swagger / API 문서 명시 부재
  - 위치: `spec/2-navigation/4-integration.md` §9.2 API 표, `GET /api/integrations/:id` 항
  - 상세: spec 은 `IntegrationDto` 에 `appUrl: string | null` 필드가 추가됨을 기술하고 있으나, Swagger/OpenAPI 스키마 갱신 필요성에 대한 언급이 없다. 이 필드는 `GET /api/integrations/:id` 응답 DTO 의 공개 변경사항이므로 API 문서(Swagger) 업데이트가 함께 이뤄져야 한다.
  - 제안: spec 변경 메모 또는 개발 plan 에 "백엔드 `IntegrationDto` 에 `appUrl` 필드 추가 및 Swagger 문서 갱신" 항목을 명시한다.

- **[INFO]** `review/consistency/2026/05/16/14_06_49/convention_compliance/review.md` — `spec-draft-*.md` 패턴이 CLAUDE.md 명명 컨벤션 테이블에 미등재
  - 위치: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 파일명 및 CLAUDE.md 명명 컨벤션 표
  - 상세: `plan/in-progress/spec-draft-<name>.md` 파일명 패턴이 프로젝트에서 반복적으로 사용되고 있으나 CLAUDE.md 명명 컨벤션 표에 등재되어 있지 않다. 신규 기여자가 "spec draft" 를 계획 문서인지 spec 초안인지 구별하지 못할 수 있다.
  - 제안: CLAUDE.md 명명 컨벤션 표에 `plan/in-progress/spec-draft-<name>.md` 패턴을 추가하고 "spec 변경 내역을 담은 plan 문서 (spec 자체가 아님)" 의미를 기술한다.

- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md` §9.9 — PR #77 로부터 본 재작성으로의 연결 고리 부재
  - 위치: §9.9 도입부
  - 상세: §9.9 는 PR #77 의 원문 결정을 완전히 재작성하지만, 어떤 PR 이 이 재작성을 수행했는지(PR #89/Phase 4) 를 섹션 내에서 명시하지 않는다. CHANGELOG 에는 `(ux-cleanup)` 행으로 기록되어 있으나, §9.9 를 직접 읽는 독자는 재작성 시점과 출처를 추적하기 어렵다.
  - 제안: §9.9 하단 "출처" 주석 블록에 PR #89 참조 또는 `2026-05-16 (ux-cleanup)` CHANGELOG 행 링크를 추가한다.

- **[INFO]** `spec/2-navigation/4-integration.md` Rationale "HMAC 검증 알고리즘 — raw URL-encoded 값 보존" 항 — `verifyHmac` 함수만 있고 `buildHmacMessage` 와의 관계 설명 부족
  - 위치: `spec/2-navigation/4-integration.md` Rationale 신규 항, 코드 예시 블록
  - 상세: Rationale 코드 예시가 `buildHmacMessage` 함수만 포함하고 있어, 이 함수가 `verifyHmac` / `verifyHmacWithMessage` 와 어떻게 연결되는지의 흐름이 코드만 보고는 파악되지 않는다. spec 의 다른 섹션(§9.8) 을 교차 참조해야만 전체 그림을 볼 수 있다.
  - 제안: Rationale 코드 블록 뒤에 "이 함수를 사용하는 검증 흐름은 `spec/4-nodes/4-integration/4-cafe24.md §9.8` 의 코드 예시를 참조" 한 줄을 추가한다.

---

### 요약

이번 변경 세트(Cafe24 HMAC raw-value 재정정 + App URL 상세 표시 + install_token 보존 정책 명문화)는 전반적으로 문서화 품질이 양호하다. spec 변경마다 CHANGELOG 항목이 추가되고, Rationale 섹션에 근거·기각 대안·보안 영향·관련 이력이 충실히 기술되어 있으며, cross-reference 링크도 대부분 유효하다. 다만 네 가지 WARNING 이 존재한다: (1) spec §9.8 코드 예시의 `verifyHmac` 단일 함수 패턴이 실제 `buildHmacMessage`/`verifyHmacWithMessage` 분리 구현과 불일치하여 독자 혼동 가능성, (2) CHANGELOG 의 `11_11_07` 세션 경로가 파일시스템에 존재하지 않아 참조 부정확, (3) §9.9 의 (A)/(B) 기호 재정의로 인한 구 Rationale 독자의 혼동, (4) `spec_files` frontmatter 키가 공식 규약에 미반영되어 동일 WARNING 이 반복될 위험. INFO 수준에서는 `IntegrationDto.appUrl` 신규 필드에 대한 Swagger 업데이트 언급 부재, `spec-draft-*` 파일명 패턴의 CLAUDE.md 미등재, `tryRecoverByMallId` 연계 미명시, §9.9 재작성 출처 링크 부재 등의 보완 사항이 있다.

### 위험도

MEDIUM

(CHANGELOG 세션 경로 오기와 spec 코드 예시-구현 불일치는 독자 혼동을 유발하고 유지보수 오류로 이어질 수 있으나, 실제 런타임 동작이나 보안에 직접 영향을 주는 항목은 없다.)
