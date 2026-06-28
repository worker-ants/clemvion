### 발견사항

- **[WARNING]** spec 문서 보안 정책 후퇴 시 Rationale 섹션 미갱신 — `spec/5-system/12-webhook.md`
  - 위치: `spec/5-system/12-webhook.md` WH-SC-01, WH-MG-02
  - 상세: WH-SC-01의 "반드시(MUST) CSPRNG v4 UUID" 요건과 WH-MG-02의 서버 `@IsUUID('4')` 강제가 plan W1(보안 미해소) 상태에서 de-specification됐음에도 `## Rationale` 섹션에 이 결정의 배경, 수용 사유, 향후 방향 언급이 전혀 없다. 이는 본 프로젝트 CLAUDE.md "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 규약의 명시적 위반이다.
  - 제안: `spec/5-system/12-webhook.md` `## Rationale` 섹션에 (1) 서버 UUID 형식 강제 미구현을 수용한 사유, (2) capability token 보안 모델이 클라이언트 `crypto.randomUUID()` 에만 의존하는 현 한계, (3) plan W1 로의 연결을 기술하는 항목 추가.

- **[WARNING]** `spec/2-navigation/2-trigger-list.md` 139행·325행 — 구 보안 모델 기술이 변경된 spec과 불일치하는 outdated 주석 수준 기술
  - 위치: `spec/2-navigation/2-trigger-list.md` 139행, 325행
  - 상세: "UUID가 사실상 capability token" 서술이 현행 정책(서버 UUID 형식 강제 없음, 임의 문자열 허용)과 명백히 불일치한다. 독자가 trigger-list.md만 읽으면 구 보안 모델을 최신으로 오독한다.
  - 제안: 해당 행의 "UUID 가 사실상 capability token" 서술을 현행 정책("유일성은 DB UNIQUE 제약이 보장하나 예측 불가능성은 클라이언트 책임") 형태로 수정.

- **[WARNING]** `spec/7-channel-web-chat/5-admin-console.md` 111행·112행·228행 — "공개 UUID" 및 "형식 제약" 기술이 현행 구현과 불일치
  - 위치: `spec/7-channel-web-chat/5-admin-console.md` 111, 112, 228행
  - 상세: 228행의 "공개 UUID" 표현, 112행의 "형식·유일성 제약" 기술이 서버 UUID 강제가 제거된 현행 구현과 맞지 않는다. 임의 문자열이 허용되는 상태에서 "UUID" 및 "형식 제약이 단일 책임"이라는 서술은 실제 보안 보장을 과장한다.
  - 제안: 228행의 "공개 UUID" → "공개 endpoint path", 112행의 "형식" 관련 기술 갱신.

- **[WARNING]** `spec/data-flow/12-workspace.md` `## Rationale` — pruner BullMQ 연결 제거 결정 근거 미기록
  - 위치: `spec/data-flow/12-workspace.md` Rationale 섹션
  - 상세: `WorkspaceInvitationsPrunerService` 삭제와 만료 row 영구 잔존 정책으로 전환한 사실이 §1.2 본문에 기술됐으나, 이 결정의 배경("토큰 만료 시 `assertTokenUsable` → 410으로 기능적 무효화됨", "범위 외 결정·defer") 이 Rationale에 없다. CLAUDE.md 규약상 "결정의 배경·근거는 Rationale"이므로 위반이다.
  - 제안: `spec/data-flow/12-workspace.md` Rationale에 pruner 제거 사유와 만료 row 잔존이 기능 정합성에 미치는 영향 없음을 기술하는 항목 추가.

- **[INFO]** `plan/in-progress/trigger-review-deferred-fixes.md` W1·W7 항목 — 채택된 방향과 반대이거나 완료된 작업이 열린 체크박스로 잔존
  - 위치: `/Volumes/project/private/clemvion/plan/in-progress/trigger-review-deferred-fixes.md` W1, W7 항목
  - 상세: W1은 "서버 강제 발급 또는 `@IsUUID(4)` 검증"으로 기술하나 구현은 반대 방향(완화). W7은 pruner 서비스가 삭제됐음에도 미완 `[ ]`으로 남아 있어 독자 오해를 유발한다.
  - 제안: W1 설명을 채택된 방향으로 수정하거나 닫기. W7을 "pruner 서비스 삭제 처리(영구 잔존 정책)"로 기술하고 닫기 또는 이관.

- **[INFO]** `spec/data-flow/12-workspace.md` §3.1 데이터 접근 패턴 표 196행 — pruneExpired 언급이 §3.1 기술과 내부 모순
  - 위치: `spec/data-flow/12-workspace.md` 196행
  - 상세: §3.1이 "pruner 호출자 없어 만료 row 영구 잔존"으로 기술하면서 데이터 접근 패턴 표에는 "만료 정리(§3.1)" + `pruneExpired` 참조가 그대로 남아 있어 표와 본문이 모순된다.
  - 제안: 196행의 "만료 정리(§3.1)" 항목에서 pruneExpired 언급 제거하거나 "호출자 없음 — 미구현" 주석 추가.

- **[INFO]** `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 헤딩이 표준 `## Overview` 에서 이탈
  - 위치: `spec/5-system/10-graph-rag.md` line 29
  - 상세: 다른 모든 spec/5-system/ 파일은 순수 `## Overview` 를 사용한다. 부가 레이블로 포맷 일관성이 깨져 자동화 도구·리뷰어가 섹션 경계를 다르게 해석할 수 있다.
  - 제안: `## Overview` 로 통일. "제품 정의" 맥락이 필요하면 섹션 도입부 한 줄 문장으로 기술.

- **[INFO]** `spec/5-system/10-graph-rag.md` — 비-목표/범위-밖 항목이 `§2.2 본 문서 범위 밖`과 `## 8. 비-목표` 두 곳에 분산 (단일 진실 원칙 위반)
  - 위치: `spec/5-system/10-graph-rag.md` line ~60, line 578
  - 상세: 동일 관심사("무엇이 범위 밖인가")가 Overview 하위와 body 말미에 각각 다른 항목으로 나뉘어 기술된다. 단일 진실 원칙상 한 곳으로 통합해야 한다.
  - 제안: `## 8. 비-목표` 항목들을 `§2.2 본 문서 범위 밖` 테이블에 통합하고 `## 8` 섹션 삭제.

- **[INFO]** `spec/5-system/17-agent-memory.md` — `X-Deleted-Count` 헤더 채택 근거가 Rationale 섹션 대신 본문 인라인에만 존재
  - 위치: `spec/5-system/17-agent-memory.md` §6
  - 상세: 프로젝트 내 처음 등장하는 커스텀 응답 헤더 API 컨벤션이지만 `## Rationale` 섹션에 채택 근거 및 기각 대안이 기록되지 않아, 향후 유사 API 설계 시 선례 탐색이 어렵다. `spec/5-system/2-api-convention.md` §5~§6도 커스텀 응답 헤더 정책을 정의하지 않아 컨벤션 공백이 있다.
  - 제안: `spec/5-system/17-agent-memory.md` Rationale에 "삭제 건수 반환 — X-Deleted-Count 헤더 채택" 항목 추가. 장기적으로 `spec/5-system/2-api-convention.md`에 멱등 DELETE + 커스텀 카운트 헤더 컨벤션 항목 신설 고려.

- **[INFO]** `spec/5-system/8-embedding-pipeline.md` 293행 — dead-declared 이벤트 `document:graph_error`를 능동 이벤트 6개 중 하나로 기술하는 stale 주석
  - 위치: `spec/5-system/8-embedding-pipeline.md` 293행
  - 상세: `spec/5-system/10-graph-rag.md §6`(SoT)과 코드는 5개 이벤트만 emit하며 `document:graph_error`는 dead-declared로 명시했으나, embedding-pipeline.md는 "6개 이벤트" + `_error` 포함 목록을 유지해 독자가 없는 이벤트를 실동 이벤트로 오독할 위험이 있다.
  - 제안: 해당 행을 "5개 이벤트 emit — `document:graph_started`, `_progress`, `_completed`, `_retry`, `_failed`(`_error` 는 dead-declared, `10-graph-rag.md §6` 참조)" 로 수정.

- **[INFO]** `spec/conventions/cafe24-api-catalog/application.md` — `## Overview` · `## Rationale` 섹션 부재
  - 위치: `spec/conventions/cafe24-api-catalog/application.md`
  - 상세: 카탈로그 파일 특수 목적을 고려하면 이해 가능하나, CLAUDE.md 3섹션 권장 구조에서 벗어난 점은 예외 근거가 규약에 명시되지 않아 반복 지적 가능성이 있다.
  - 제안: `spec/conventions/spec-impl-evidence.md §1` 제외 예외 항목에 "카탈로그 최상위 `<resource>.md` 인덱스는 `_overview.md` 를 Rationale SoT로 위임" 예외 근거 명시.

- **[INFO]** `spec/5-system/1-auth.md §2.1` — Refresh Token 유효기간 표에 rememberMe 30일 variant 미기술
  - 위치: `spec/5-system/1-auth.md §2.1` Refresh Token 행
  - 상세: data-model spec은 "7일 기본, rememberMe 시 30일"로 명시하지만 auth spec §2.1은 "7일"만 표기해 rememberMe 파라미터 존재가 auth spec 단독으로는 불명확하다. 인라인 주석이 현행 구현과 불일치하는 수준의 outdated 문서다.
  - 제안: `spec/5-system/1-auth.md §2.1` Refresh Token 행을 "7일 (기본) / 30일 (rememberMe=true)"로 갱신.

### 요약

이번 변경(spec/5-system/ 일관성 검토 결과 2세트 + spec 파일 소수 수정)에서 문서화 관점의 핵심 문제는 보안 정책을 후퇴(de-specification)시키면서 Rationale에 배경을 기록하지 않은 점이다. `spec/5-system/12-webhook.md`는 WH-SC-01/WH-MG-02를 단순화하면서 Rationale 항목을 추가하지 않았고, `spec/data-flow/12-workspace.md`는 pruner 제거 결정의 근거를 본문 서술에만 남긴 채 Rationale을 갱신하지 않았다. 이 두 건은 프로젝트 CLAUDE.md의 단일 진실·Rationale 기록 규약을 명시적으로 위반하며 WARNING으로 분류한다. 추가로 trigger-list.md·admin-console.md의 구 보안 모델 기술이 현행 구현과 불일치하는 outdated 기술도 WARNING 수준이다. 나머지 발견사항(embedding-pipeline stale 이벤트 수, graph-rag.md 헤딩·비-목표 분산, auth spec rememberMe 누락, X-Deleted-Count Rationale 부재)은 모두 INFO로 독자 혼동이나 미래 작업 오해를 유발할 수 있으나 현재 구현을 차단하지 않는다.

### 위험도

MEDIUM
