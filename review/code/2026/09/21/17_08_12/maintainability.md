# 유지보수성(Maintainability) 리뷰

## 스코프 메모

이번 diff 는 (1) 실제 코드 변경 4건(`CHANGELOG.md`, `model-config.service.ts`,
`model-config.service.spec.ts`, `model-config-delete-concurrency.e2e-spec.ts`) +
plan 문서 2건과, (2) 직전 리뷰 라운드(`review/code/2026/09/21/16_39_52/*`,
`review/consistency/2026/09/21/16_16_35/*`)의 산출물(신규 커밋으로 편입된 리포트·
상태 JSON) 24건으로 구성된다. 후자는 CLAUDE.md 가 규정하는 workflow 산출물(코드
리뷰·consistency-check 결과)이며 사람이 짠 실행 로직이 아니므로, 가독성·네이밍·
함수 길이·중첩·매직넘버·순환복잡도 관점의 코드 리뷰 대상이 아니다 — 아래 발견사항은
전부 (1)에 대한 것이다. 직전 라운드의 `maintainability.md`(파일 16)가 이미 같은
코드를 검토해 WARNING 1건(e2e 중복)·INFO 4건을 냈고, 그중 WARNING 은 이번 라운드의
`01c6130f5`(plan 결정-고정) 커밋으로 처리됐다 — 아래에서 그 처리의 타당성을 재확인한다.

## 발견사항

- **[INFO]** 동시성 e2e 스펙 9번째 사본 — 중복은 여전하나 이번 라운드에 "결정"이 고정됐다
  - 위치: `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` (전체, 1~125행)
  - 상세: `auth-config-delete-concurrency.e2e-spec.ts` 등 8개 형제 파일과 리소스명·라우트·
    404 코드·request body 필드만 다를 뿐 구조(락 획득 → `Promise.all` 로 겹침 생성 →
    공허성 가드 → 커밋 → 상태쌍/감사 카운트 단언 → `finally` 정리)가 사실상 동일하다.
    직전 라운드 리뷰가 WARNING 으로 지적했고, 이번 fix 는 코드를 합치는 대신
    `plan/in-progress/modelconfig-dup-delete.md` §"이 PR 이 하지 않는 것"을 고쳐(커밋
    `01c6130f5`) "9번째(WebAuthn) PR 은 **착수 시점**에 공용 헬퍼 추출 여부를 실제로
    결정하고 그 결정을 plan 에 명시하는 것을 **선행 조건**으로 한다"는 조항을 추가했다.
    "유예를 또 유예로 넘기지 않는다"는 문구까지 넣어, 이전 두 라운드가 반복했던
    "다음에 재검토" 식 무근거 이월을 구조적으로 막아 둔 점은 타당한 처리다.
  - 판단: 코드 중복 자체는 그대로 남지만, 결정을 미루지 않고 다음 PR 의 게이트 조건으로
    고정한 것은 이 프로젝트의 결정-고정 관례(WARNING3 → `01c6130f5`)에 부합한다. 이번
    라운드에서 새로 차단할 사유는 없다 — INFO 로 하향해 기록만 남긴다.
  - 제안: 없음(다음 PR 의 선행 조건이 이미 명문화됨). 9번째 PR 착수 시 그 조항이 실제로
    지켜지는지만 확인하면 된다.

- **[INFO]** `remove()` 의 주석 밀도가 실행 코드보다 훨씬 높다(형제 컨벤션과 일치)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:403-442`
    (`async remove(...)`)
  - 상세: 함수 본문 실행문은 6줄(조회 → 구조분해 → delete → 분기 → notify → recordAudit)인데
    그 사이에 삽입된 근거 주석은 약 20줄이다. 다만 같은 자리에서 `auth-configs.service.ts:296-330`
    의 `remove()`를 직접 대조한 결과 동일한 밀도·동일한 절 구성(락 부재 근거 → 판정 근거 →
    등가성 실측 → 404 코드 선정 근거)을 그대로 쓰고 있어, 이 PR 이 새로 도입한 스타일이
    아니라 형제 7건이 이미 정착시킨 컨벤션의 연장이다. 코드 자체(if-throw 단일 분기, 중첩
    없음)의 순환 복잡도는 낮다.
  - 제안: 조치 불요. 9번째(WebAuthn) 처리 시 공통 근거를 `spec/conventions/`로 옮기는 안이
    이미 이전 라운드 INFO/plan 에 예정돼 있으므로 그때 재검토하면 된다.

- **[INFO]** 죽은 `mockRepo.remove` fixture 제거로 테스트 가독성이 개선됨(모범 사례)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts:34-40`
    (`mockRepo` 정의부)
  - 상세: 이전 라운드 INFO 1 이 지적한, `remove()`→`delete()` 전환 후 어떤 테스트에서도
    참조되지 않던 `remove: jest.fn().mockResolvedValue(undefined)` fixture가 이번 fix
    커밋(`153152d85`)으로 제거됐다. `grep -n "mockRepo\.remove"` 재확인 결과 0건 — 죽은
    코드가 완전히 사라졌다. 대신 들어온 `delete: jest.fn<Promise<DeleteResult>, [unknown]>()`
    타입 명시는 같은 코드베이스의 `retry-with-backoff.util.spec.ts` 에 이미 있는 관용구와
    일치해 새 패턴을 만들지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 신규 `describe('remove — 동시 삭제', ...)` 블록의 `entity()` 팩토리·`it.each`
  사용이 중복을 잘 억제한다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts:1097-1145`
  - 상세: 두 테스트가 공유하는 fixture 를 `entity()` 팩토리로 뽑았고, `undefined`/`null`
    두 대조군 케이스를 `it.each([[undefined],[null]])` 로 묶어 판별자(`affected === 0`
    명시 비교)의 대조군을 반복 없이 표현했다. 테스트명(`'affected 가 %p(드라이버
    미보고)면 정상 삭제로 취급한다'`)도 목적이 분명해 실패 시 원인 추적이 쉽다.
  - 제안: 조치 불요.

- **[INFO]** CHANGELOG 정정이 취소선 + 인접 정정 문단 관례를 정확히 재사용함
  - 위치: `CHANGELOG.md:85-95` (7번째 항목의 "남는 것" 절 취소선 + `> 정정 (2026-09-21, …)`
    인용 블록), `CHANGELOG.md:13-16` (8번째 항목에 "직전 항목 예고는 과장" 명시)
  - 상세: markdown 문법(`~~...~~`, `>` blockquote)이 올바르게 닫혀 있고, 배포 이력을
    보존하는 "원문 취소선 + 인접 정정" 패턴이 트래커 문서(`spec-draft-nullable-notation-followups.md`)
    의 정정 패턴과 동일해 문서 전반의 정정 컨벤션이 일관된다. 새 8번째 항목에서도 같은
    사실을 반복 서술하지 않고 "직전 항목의 예고는 과장이었다"로 한 줄 참조해 중복을 피했다.
  - 제안: 조치 불요.

## 요약

실제 코드 변경(서비스·유닛테스트·e2e테스트)은 형제 PR 7건(#1369~#1374)과 동일한
"무락 조회 + 원자적 DELETE 의 `affected` 명시 비교" 패턴을 정확히 재사용했고, 네이밍·
주석 스타일·에러 코드 재사용·테스트 구조 모두 기존 컨벤션과 일치한다. 함수 길이·중첩
깊이·매직 넘버·순환 복잡도 관점에서 새로 도입된 문제는 없다. 이번 라운드의 fix
커밋들은 직전 리뷰가 지적한 항목을 실질적으로 개선했다 — 죽은 mock fixture 제거,
CHANGELOG 관례 준수 및 과장 서술 정정, JSDoc 보강. 유일하게 반복 관측되는 항목은
동시성 e2e 스펙 파일의 구조적 중복(9번째 사본)인데, 이번 라운드는 이를 "또 유예"하는
대신 다음(9번째, WebAuthn) PR 착수 시점에 공용 헬퍼 추출 여부를 실제로 결정하도록
plan 에 선행 조건으로 못박아 처리했다 — 코드 중복 자체는 남아 있지만 결정 회피의
반복 패턴은 끊겼으므로 이번 라운드를 막을 사유는 아니다(INFO 로 하향).

## 위험도

LOW
