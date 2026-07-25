# 정식 규약 준수 검토

## 조사 방법 메모

이번 검토 요청의 `target 문서` 는 `spec/conventions/` 전체로 지정돼 있으나, 프롬프트에 실제
포함된 본문은 대부분 이번 diff 와 무관한(변경 없는) `cafe24-api-catalog/**` reference 문서
250여 개 중 일부였고, 컨텍스트 예산 초과로 정작 이번 코드 변경이 반복 인용하는
`spec/conventions/node-cancellation.md` 는 "생략된 파일" 목록에 들어 프롬프트 본문에서 빠져
있었다. `git -C node-cancel-signal-b4d1 diff origin/main --stat` 로 실제 diff 범위를 확인한 결과
`spec/conventions/` 자체는 이번 PR 에서 전혀 변경되지 않았고(코드만 변경), 실제로 관련성 있는
컨벤션은 `node-cancellation.md` §4/§5.1/§6 이었다(변경된 4개 파일의 코드 주석이 해당 절 번호를
직접 인용). 이에 따라 절대경로로 `node-cancellation.md` 를 직접 Read 하고, 관련 diff·plan 파일
(`plan/in-progress/node-cancellation-residual-signal-propagation.md`)을 대조해 검토했다.

## 발견사항

- **[WARNING]** `node-cancellation.md` §6 구현 현황 표 2행이 이번 PR 로 stale 화됨 (단, 이미 추적됨)
  - target 위치: `spec/conventions/node-cancellation.md` §6 (137~139행), 행 "MakeShop 노드 signal 전파" / "Cafe24 노드 signal 전파"
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` (frontmatter/§6 류 구현 현황 표는 "구현 lifecycle 을 추적할 product surface" 의 ground truth 여야 한다는 취지) — 및 본 문서 자체의 "2026-06-03 코드 대조로 갱신" 이라는 최신성 전제
  - 상세: 이번 diff 는 `Cafe24CallOptions.signal`/`MakeshopCallOptions.signal` 신설 + handler 의 `context.abortSignal` 전달 + client 의 §4 cascade + §5.1 AbortError 재throw 를 정확히 구현했다(코드 주석이 `node-cancellation.md §4`/`§5.1` 을 직접 인용). 그런데 §6 표는 여전히 두 행 모두 `— 미구현 (Planned)` 로 남아 실제 코드 상태와 어긋난다. 다만 이는 방치가 아니라 **이미 올바르게 위임된 상태**다 — `plan/in-progress/node-cancellation-residual-signal-propagation.md` 가 두 항목을 `[x]` 로 체크하고 "§6 표 두 행 갱신은 `spec/` 권한 밖이라 planner 위임" 이라고 명시한다(CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 규칙을 정확히 준수).
  - 제안: 후속 `project-planner` 세션에서 §6 두 행을 ✓(구현됨) 로 갱신하고, frontmatter `code:` 목록에 `cafe24.handler.ts`/`cafe24-api.client.ts`/`makeshop.handler.ts`/`makeshop-api.client.ts` 를 추가 반영. 현재 build-time 가드(`spec-code-paths.test.ts`)는 `code:` 비어있지 않은 리스트 + 1개 이상 실재 경로만 요구해 이 gap 으로 실패하지는 않는다(확인함) — 즉 CRITICAL 은 아님.

- **[WARNING]** §4 예시 코드가 이번 PR 이 고친 리스너 leak 패턴을 그대로 담고 있음
  - target 위치: `spec/conventions/node-cancellation.md` §4 (76~99행) — cascade 예시 코드 블록
  - 위반 규약: 본 문서가 "정식 규약" 으로 제시하는 canonical 구현 패턴 자체의 정확성(다른 구현자가 그대로 복제할 참조 코드)
  - 상세: §4 예시는 upstream 리스너 해제를 `controller.signal` 의 `'abort'` 이벤트에 걸어두는데, 이 이벤트는 로컬 controller 자신이 abort 될 때만 발화하며 **정상 완료된 요청에서는 절대 발화하지 않는다** — 즉 성공 케이스마다 리스너가 leak. 이번 PR 의 코드 리뷰(`review/code/2026/07/25/21_02_33`, plan 파일에 인용)가 정확히 이 결함을 cafe24/makeshop 신규 구현에서 발견해 cleanup 을 `finally` 로 옮겨 수정했고, 동일한 선재 결함이 이 §4 예시로부터 파생된 `http-request.handler.ts` 에도 있음을 확인했다. plan 파일이 "spec §4 예시 자체가 그 누수 패턴이라 spec 갱신과 함께 가야 한다(planner 위임에 기재)" 라고 명시적으로 남겨 이미 추적 중이다.
  - 제안: §4 예시 코드를 `finally` 기반 cleanup(또는 동등한 성공 경로 포함 해제)으로 교체 — 위 §6 갱신과 함께 project-planner 후속 커밋에서 처리 권장. 문서 정확성 이슈이며 지금 당장 PR 을 막을 사안은 아니다.

- **[INFO]** cafe24-api-catalog operation id 네이밍 — `store.md` 의 `privacy_*` 와 별도 `privacy` resource 간 접두 혼동 (이미 문서 내 자체 인지·후속 defer 됨)
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §5 하단 주석 / 실제 사례는 `store.md` 85~90행(`privacy_boards_get`, `privacy_join_get`, `privacy_orders_get` 등)
  - 위반 규약: `_overview.md` §2 표 컬럼 정의 — `id` 는 "resource 내 unique" 로만 규정, cross-resource 네이밍 충돌은 다루지 않음
  - 상세: 확인 결과 `privacy.md` 실제 id 들(`customers_privacy_get`, `products_wishlist_customers_list` 등)은 `privacy_` 접두를 쓰지 않아 `catalog-sync.spec.ts` §4 규칙6(resource 내 unique)을 깨뜨리진 않는다 — 순수 가독성/개념 혼동 우려다. `_overview.md` 자체가 이미 "별 트랙으로 follow-up 가능" 이라 명시해뒀다.
  - 제안: 조치 불필요(이미 낮은 우선순위로 tracked). 단, 재차 다뤄질 경우 참고용으로 남김.

- **[INFO]** `cafe24-api-catalog/_overview.md` 가 명시적 `## Overview` 헤더 없이 H1 타이틀에 "— Overview" 만 표기
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 최상단 (H1: `# CONVENTION: Cafe24 API Catalog — Overview`)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
  - 상세: 본문은 곧바로 디렉토리 구조·표 정의로 진입하고 별도 `## Overview` 섹션 헤더가 없다. 같은 폴더의 `audit-actions.md` 는 명시적 `## Overview` 헤더를 갖고 있어 conventions 문서 간 스타일이 일관되지 않는다. `## Rationale` 은 문서 말미에 정상적으로 존재.
  - 제안: 강제 사항 아님(recommend). 스타일 일관성이 중요하면 prose 도입부 위에 `## Overview` 헤더를 명시적으로 추가.

## 요약

이번 PR(node-cancel-signal) 의 diff 는 `spec/conventions/` 자체를 전혀 변경하지 않았으며, 코드
변경(Cafe24/MakeShop client·handler 의 `abortSignal` 배선)은 `node-cancellation.md` §4(cascade)·
§5.1(AbortError 분류) 이 규정한 패턴을 정확히 구현했다 — 코드 주석이 절 번호를 직접 인용하며
따른다는 점에서 정식 규약 준수도는 양호하다. 다만 그 결과로 `node-cancellation.md` §6 구현 현황
표의 두 행과 §4 예시 코드(리스너 leak 패턴)가 현재 코드 상태보다 뒤처진 stale 상태이며, 이는
developer 의 `spec/` 쓰기 권한 부재로 인해 `project-planner` 에게 정확히 위임된 상태임을
`plan/in-progress/node-cancellation-residual-signal-propagation.md` 에서 확인했다 — 즉 절차
위반이 아니라 예정된 후속 작업이다. cafe24-api-catalog 하위 문서(이번 diff 와 무관, 미변경)는
frontmatter 예외 규칙(spec-impl-evidence.md §1) 을 올바르게 따르고 있으며, 발견된 네이밍·구조
이슈는 모두 INFO 수준이거나 문서 자체가 이미 인지·defer 한 사항이다. 종합적으로 CRITICAL 위반은
없으며, WARNING 2건은 모두 실측 확인됐지만 이미 올바른 프로세스로 추적 중인 "예정된 stale" 상태다.

## 위험도

LOW
