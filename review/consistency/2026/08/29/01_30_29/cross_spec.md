# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, eslint10-upgrade)

## 검토 범위 요약

실제 diff(`origin/main...HEAD`)는 매우 좁다:

- spec 변경: `spec/5-system/3-error-handling.md` §6.3 하위에 신규 **§6.3.1 "에러 wrapping 시 `Error.cause` 부착 기준"**(조건 C1 AND C2) 추가 + 대응 Rationale 항목 1건.
- 코드 변경: `expression-resolver.service.ts`/`.spec.ts`, `secret-resolver.service.ts`, `code.handler.ts`/`.spec.ts` — eslint 10 `preserve-caught-error` 규칙 대응 주석을 새 §6.3.1 을 정본으로 가리키도록 정리 + `code.handler.spec.ts` 의 realm 오류 정정(isolate 경계 아님 → Jest realm).

번들에 포함된 `1-auth.md`·`2-api-convention.md`·`0-overview.md` 등 전체 본문은 diff 대상이 아니라 관련 컨텍스트로만 포함된 것으로 보인다(§6.3.1 은 이 문서들의 어떤 선언과도 직접 상호작용하지 않음).

## 교차 확인 내역

1. **중복/충돌 정의 여부** — `spec/**` 전체에서 `Error.cause`·`preserve-caught-error` 를 다루는 곳이 §6.3.1 신설 이전에는 전무함을 확인(grep 전수, `3-error-handling.md` 외 0건). 신규 개념이며 기존 규약과의 직접 충돌 없음.
2. **경계 명시 — REST 봉투 vs 내부 `cause`**: §6.3.1 은 스스로 "REST 표준 봉투 경로는 §2/`2-api-convention.md §5.3`(원문 echo 무조건 금지)이 먼저 적용되고, 본 절의 C1/C2 전제(원문을 이미 담은 message) 자체가 REST 경로에서는 §5.3 위반"이라고 명시해 두 절의 적용 범위를 스스로 분리했다. `2-api-convention.md §5.3`(현재 코드 그대로 노출, 미변경)과 상충 없음.
3. **`output.error` envelope(§3.2, node 레벨) 과의 관계**: `output.error` 필드 정의(`code`/`message`/`details`)에 `cause` 라는 wire 필드가 없고, §6.3.1 도 `cause` 를 wire 로 노출하는 절이 아니라 "던지는 시점에 JS `Error.cause` 를 붙일지"만 규정한다 — 두 절이 다루는 계층이 다르며 모순 없음. 다만 `details` 열 예시(`stack` 포함, §3.2 표)는 이번 diff 대상이 아니라 범위 밖.
4. **`describeFetchError`(telegram-client.ts) 와의 관계**: 이 함수도 `.cause` 를 언랩해 로그 문자열로 만드는 별도 기존 패턴인데, §6.3.1 Rationale 이 "로그 전용 unwrap 인 `describeFetchError` 는 별개" 라고 명시적으로 범위 밖 처리해 스스로 경계를 그었다 — 충돌 아님, 오히려 인접 사례를 정확히 식별.
5. **코드 소유(SoT) 정합성**: 변경된 4개 코드 파일(`expression-resolver.service.ts`, `secret-resolver.service.ts`, `code.handler.ts`, 각 `.spec.ts`)은 각각 `spec/5-system/4-execution-engine.md`(`execution-engine/**` glob), `spec/conventions/secret-store.md`(`secret-store/**` glob), `spec/4-nodes/5-data/2-code.md`·`0-common.md`(`code.handler.ts` 명시)의 기존 `code:` frontmatter 에 이미 포함되어 있어 신규 orphan 코드가 아니다. `3-error-handling.md` 의 `code:` 목록에는 이 4개 파일이 없지만, 이는 §6.3.1 이 "표기·규율의 SoT" 이고 실제 구현은 각 도메인 spec 이 소유하는 기존 패턴(§1 의 "도메인 spec 참조" 방식)과 동형이라 계층 책임 충돌로 보지 않는다.
6. **레이블 재사용 검토**: 신설 테이블의 로컬 레이블 `C1`/`C2` 는 §6.3.1 범위에 국한되며, 문서 내 다른 곳(`refactor 04 C-1` 등, 하이픈 포함 plan 식별자)과 표기가 달라 혼동 가능성이 낮다. 정식 요구사항 ID 레지스트리(`WH-NF-02`, `SS-SE-05` 류)와도 네임스페이스가 겹치지 않는다.
7. **RBAC·상태 전이·API 계약**: 이번 diff 는 RBAC 매트릭스(§3), 세션/토큰 상태 전이(§2), API 엔드포인트 표(§5)를 전혀 건드리지 않는다. 번들에 포함된 `1-auth.md`/`2-api-convention.md` 본문은 diff 이전 상태 그대로이며 이번 변경과 상호작용하는 지점이 없다.

## 발견사항

특이사항 없음 — CRITICAL/WARNING 없음.

- **[INFO]** §3.2 `output.error.details` 예시 열거에 `stack` 이 포함되어 있음 (line ~1260, `spec/5-system/3-error-handling.md`)
  - target 위치: 이번 diff 범위 밖(§3.2, 미변경)
  - 충돌 대상: 신설 §6.3.1 의 "노드 에러는 Activity API 로 노출되므로 내부 상세를 감춘다" 는 취지
  - 상세: 직접 모순은 아니나(별도 절·별도 계층), `details.stack` 이 실제로 채워지는 노드가 있다면 §6.3.1 이 우려하는 것과 같은 종류의 정보 노출 표면이 이미 존재할 수 있다. 이번 PR 이 만든 gap 은 아니므로 CRITICAL/WARNING 이 아니라 참고용 INFO.
  - 제안: 별도 트랙(코드 리뷰 또는 spec-coverage)에서 `details.stack` 실제 사용처를 감사할 가치는 있으나, 본 PR 의 diff 범위는 아니므로 이번 검토에서는 조치 불요.

## 요약

이번 변경은 `spec/5-system/3-error-handling.md` §6.3 하위에 `Error.cause` 부착 여부를 판정하는 신규 §6.3.1(C1 AND C2)을 추가하고, 이를 정본으로 가리키도록 4개 backend 코드 파일의 eslint 10(`preserve-caught-error`) 대응 주석을 정리한 것이 전부다. 신규 개념(`Error.cause`)은 `spec/**` 어디에도 기존 정의가 없어 중복·모순 정의 위험이 없고, §6.3.1 스스로 REST 봉투 경로(§2·`2-api-convention.md §5.3`)·로그 전용 unwrap(`describeFetchError`)과의 경계를 명시해 인접 규약과의 충돌을 사전에 차단했다. 변경된 코드 파일은 모두 기존 spec 의 `code:` frontmatter glob 에 이미 포함되어 있어 코드 소유권(SoT) 상의 orphan 도 없다. RBAC·상태 전이·API 계약·요구사항 ID 레지스트리 어느 축에서도 다른 영역과의 충돌을 발견하지 못했다.

## 위험도

NONE
