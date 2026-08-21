# 유지보수성(Maintainability) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (5라운드, 02_04_38)

## 검토 범위

이 브랜치는 이미 4라운드(`00_03_57`→`00_39_27`→`01_15_47`→`01_38_26`) 유지보수성 리뷰를 거쳤고
각 라운드의 CRITICAL/WARNING(검사 시점 재작업·호출부 중복 제거·`isPlainRecord`→`isRecord`
교체·repo-guard 도입)은 실코드로 재확인한바 실제로 해소돼 있다. 이번 라운드는 그 산출물이
그대로 커밋에 실린 것 외에 실질 신규 표면인 repo-guard 두 파일
(`masked-reject-callers-guard.ts`, `masked-reject-callers.spec.ts`)을 포함한 핵심 8개
프로덕션 파일을 프롬프트가 아니라 `Read` 로 직접 열어 전체 컨텍스트로 재검증했다.

## 발견사항

- **[WARNING]** `Object.freeze(new Set(...))` 는 `Set` 인스턴스의 `.add()`/`.delete()` 를 막지
  못한다 — 직전 라운드가 "닫았다"고 기록한 런타임 불변식이 실제로는 열려 있다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150-152`
    (`export const MASKED_MARKERS: ReadonlySet<string> = Object.freeze(new Set([...]));`)
  - 상세: `01_15_47` 라운드(`side_effect.md` INFO → `RESOLUTION.md` "INFO-4")는 *"타입 우회로
    `MASKED_MARKERS` 를 변형하면 `isMaskedMarker`(egress 마스킹)와
    `findMaskedResubmissions`(이번 PR 의 재제출 거부, 같은 싱글턴 공유)가 동시에 오염된다"*
    는 근거로 `Object.freeze` 를 추가했다. 그런데 `Object.freeze()` 는 대상 객체의 **own
    property** 추가/삭제/재할당만 막을 뿐이고, `Set`/`Map` 의 데이터는 own property 가 아니라
    내부 슬롯([[SetData]])에 저장된다. `Set.prototype.add`/`delete`/`clear` 는 그 내부 슬롯을
    직접 조작하며 대상이 frozen 인지 검사하지 않으므로, freeze 이후에도 `.add()`/`.delete()`
    가 예외 없이 성공한다. 직접 실행해 확인했다:
    ```js
    const s = Object.freeze(new Set(['a', 'b']));
    s.add('c');           // 예외 없음
    console.log(s.size);  // 3 — 실제로 변형됐다
    ```
    즉 이 줄은 컴파일 타임 `ReadonlySet<string>` 표시에 아무 것도 더하지 않는 **플라시보**다.
    문제는 성능이나 즉시 악용 경로가 아니라(현재 이 Set 을 직접 mutate 하는 소비처는 없다)
    **주석·RESOLUTION 이 "런타임에서도 막았다"고 명시적으로 서술**하고 있다는 점이다 — 다음
    사람이 이 문구를 읽고 "타입 단언 우회 변형은 이미 방어돼 있다"고 믿은 채 다른 안전장치
    없이 이 싱글턴을 계속 공유 확장하면, 실제로는 아무 보호도 없는 상태에서 신뢰만 쌓인다.
    이 시리즈 자체가 "미러 발산·주석은 규칙을 강제하지 못한다"를 반복 근거로 삼아 온 만큼,
    이 한 줄은 그 원칙에 스스로 반례가 된다.
  - 제안: 다음 중 하나로 실제 런타임 불변성을 확보하거나, 안 되면 주석의 과장을 걷어낸다.
    (1) `Set` 대신 `readonly string[]`(예: `Object.freeze([...])`)를 저장하고
    `isMaskedMarker` 는 `MASKED_MARKERS.includes(v)` 로 바꾼다 — 배열은 own property(길이·
    인덱스)로 데이터를 갖고 있어 `Object.freeze` 가 실제로 추가/삭제를 막는다(원소 수가
    3개라 O(n) 비용은 무시 가능). (2) 정말 `Set` 을 유지해야 하면 `add`/`delete`/`clear` 를
    노출하지 않는 `Proxy` 로 감싼다(구현 비용이 더 크다). (3) 위 두 가지가 과하면
    `Object.freeze` 호출 자체를 지우고 주석을 *"컴파일 타임 `ReadonlySet` 표시만이며, 타입
    단언 우회는 막지 않는다"* 로 정정한다 — 최소한 거짓 보장을 남기지는 않는다.

## 그 외 확인 사항 (발견 아님)

- `reject-masked-resubmission.ts`: 함수 하나(`resolveTriggerParametersRejectingMasked`)가
  raw→resolve 검사 순서를 캡슐화해 두 호출부(`executions.service.ts:499`,
  `workflows.controller.ts:317`)가 각각 한 줄 호출로 남아 있음을 실코드로 확인 — `00_03_57`
  WARNING4 가 실제로 해소돼 있다.
- `isPlainRecord` 로컬 재구현은 삭제되고 `to-record.ts` 의 공유 `isRecord` 를 import 함을
  확인(`reject-masked-resubmission.ts:11`, `:121`) — `00_39_27` WARNING1 해소 확인.
- `masked-reject-callers-guard.ts`/`.spec.ts`: 파서(순수 로직)와 소비 spec 을 분리하는 이
  저장소의 기존 repo-guard 규약(`eslint-unicorn-peer-guard.ts` 등)을 그대로 따르고, 허용목록
  갱신 캐너리·접두 겹침 오탐 방지 캐너리로 가드 자체의 사각지대를 테스트가 고정하고 있어
  가독성·의도 명확성이 높다. `listSourceFiles` 의 디렉터리 재귀 walker 가 저장소 내 다른
  repo-guard 들과 유사 보일러플레이트를 반복하지만, 이는 이 저장소가 기존에도 각 가드마다
  독립적으로 허용해 온 패턴이라(`config-env-coverage.spec.ts` 등 다수) 이번 diff 가 새로
  만든 이탈이 아니다 — 별도 지적하지 않는다.
- 함수 길이·중첩 깊이·순환 복잡도: `hasMaskedLeaf`/`findMaskedResubmissions`/`throwIfAny`
  모두 짧고 단일 책임, 중첩은 최대 2단(`Array.isArray` / `object` 분기)이다. 매직 넘버 없이
  `MAX_REDACT_DEPTH` 상수를 재사용한다.
- `workflows.controller.ts:314-322` 의 신규 한국어 인라인 주석과 인접한 기존 영어 주석
  (`:325-327`) 혼재는 `00_03_57`/`01_38_26` documentation 리뷰가 이미 INFO 로 등재하고
  조치 불요로 처분한 항목과 동일 — 재등재하지 않는다.

## 요약

핵심 구현은 4라운드에 걸쳐 CRITICAL(boolean 완전 우회)과 다건의 WARNING(호출부 중복·타입가드
재구현·불변식 미강제)이 실제로 해소된 상태이고, 이번 라운드에서 직접 연 소스로 재확인해도
그 결론은 유지된다. 함수 길이·네이밍·복잡도·매직 넘버·기존 repo-guard 패턴 정합성 전부
양호하다. 새로 찾은 유일한 항목은 `01_15_47` 라운드가 "런타임 freeze 로 닫았다"고 기록한
`MASKED_MARKERS` 보호가 JS 의미론상 실제로는 아무 것도 막지 못하는 플라시보라는 점이다 —
즉시 악용 경로는 없지만, 코드·RESOLUTION 문서가 존재하지 않는 보장을 서술한다는 점에서 이
시리즈가 스스로 여러 번 경계해 온 "주석은 규칙을 강제하지 못한다"는 원칙에 반례가 되므로
WARNING 으로 등재한다.

## 위험도

LOW
