# 유지보수성(Maintainability) 리뷰

## 조사 방법

`git diff --stat origin/main...HEAD -- codebase/` 로 실제 코드 diff 범위를 재확인했다(5개
`codebase/**` 파일, `+236/-12`). 나머지 프롬프트 상 파일(`CHANGELOG.md`, `plan/**`,
`review/code/**`, `review/consistency/**`, `spec/**`)은 코드가 아닌 문서/이전 리뷰
산출물/spec 이라 이번 유지보수성 관점 판단 대상에서 제외했다(문서·spec 정합은 별도
reviewer 스코프).

이전 두 라운드(`16_46_56` WARNING #3 JSDoc 배치, `17_14_18` INFO 테스트 커버리지 8종
비대칭)가 이번 소스에서 실제로 해소됐는지 `Read`/`grep` 으로 `explore-tools.service.ts`·
`handler-output.adapter.spec.ts` 현재 상태를 직접 열어 재확인했다.

## 확인했지만 문제 없음 (이전 라운드 WARNING/INFO 해소 재확인)

- `16_46_56` WARNING #3(새 헬퍼 `redactAssistantFields` + JSDoc 이 클래스 JSDoc 과 클래스
  선언 사이에 낌)은 해소됨을 직접 확인했다 — 헬퍼+JSDoc(`explore-tools.service.ts:53`-`104`)
  이 이제 클래스 JSDoc(`:106`-`119`) **위**, 상수 선언부 바로 아래에 있고, 클래스 JSDoc 과
  `@Injectable()`/`class` 선언(`:121`-`122`) 사이에는 다시 빈 줄 하나만 남아 인접성이
  회복됐다.
- `17_14_18` INFO(`handler-output.adapter.spec.ts` 의 `token` 계열 `it.each` 가 유틸 spec 과
  달리 5종만 덮어 `authToken`/`sessionToken`/`idToken` camelCase 3종이 빠짐)도 해소됨을
  확인했다 — 현재 `handler-output.adapter.spec.ts:97`-`105` 의 `it.each` 가 유틸 spec
  (`mask-sensitive-fields.util.spec.ts:87`-`96`)과 동일한 8종(snake_case+camelCase 각 4쌍)을
  덮는다.
- `redactAssistantFields` 자체는 짧고(구조적 타입 파라미터 + 3줄 반환) 중첩·매직넘버·복잡도
  문제가 없으며, `toNodeExecutionEnvelope`/`toExecutionEnvelope` 두 호출부의 기존 3줄씩
  반복 호출을 스프레드(`...redactAssistantFields(ne)`, `...redactAssistantFields(e)`)로
  통합해 중복을 줄였다.
- 신규 테스트(`mask-sensitive-fields.util.spec.ts` `it.each` 8건 + 대조군,
  `explore-tools.service.spec.ts` 캐너리 2건)는 기존 파일의 네이밍·구조·`describe`/`it`
  스타일과 일관되고, mock 설정 보일러플레이트도 같은 파일 내 기존 테스트들과 동일한
  패턴이라 새로운 중복으로 보지 않았다.
- 함수 길이·중첩 깊이·순환 복잡도 모두 이번 diff 범위(5개 코드 파일) 안에서 문제될 만한
  증가가 없다.

## 발견사항

- **[INFO]** 신설 module-level 헬퍼 `redactAssistantFields` 의 배치가 같은 파일의 기존
  helper 배치 관례와 어긋난다
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts`
    (`redactAssistantFields`, 89번 줄 부근) vs 같은 파일의 `clampLimit`(586번 줄 부근)·
    `normalizeStatusFilter`(596번 줄 부근)
  - 상세: 이 파일은 원래 "클래스 전용이 아닌 순수 module-level 헬퍼는 파일 **하단**, 클래스
    닫는 `}` 뒤에 모아 둔다"는 관례를 갖고 있다(`clampLimit`·`normalizeStatusFilter` 둘 다
    파일 맨 끝에 있음). `16_46_56` WARNING #3 을 고치면서 `redactAssistantFields` 는 그
    관례를 따르는 "클래스 아래로 이동" 대신 "클래스 JSDoc 위, 상수 선언부 근처로 이동"
    쪽을 택했다(당시 리뷰 제안에 둘 다 있었음). 결과적으로 JSDoc 샌드위치 문제는 해소됐지만,
    이제 같은 파일 안에 "module-level pure 헬퍼는 파일 하단"과 "module-level pure 헬퍼는
    파일 상단"이라는 두 배치 관례가 공존한다. 다음에 비슷한 헬퍼를 추가하는 사람이 어느
    쪽을 따라야 할지 파일만 보고는 판단하기 애매해진다.
  - 제안: 급하지 않음. 굳이 지금 통일할 필요는 없으나(위로 옮긴 이유가 "클래스 doc 근접
    상수와 함께 두어 맥락을 살린다"는 합리적 트레이드오프였음), 다음에 이 파일에
    module-level 헬퍼를 추가할 때는 "값/상태 마스킹류 헬퍼는 상단, 순수 유틸리티 변환류는
    하단"처럼 배치 기준을 주석 한 줄로 남겨 두면 관례 분기가 우발적으로 보이지 않는다.

## 참고 (재확인, 조치 불요 — 이전 라운드에서 이미 논의·처분됨)

- 내부 컴포즈 함수 이름 `both`(`explore-tools.service.ts:98` 부근)는 여전히 이름만으로
  "무엇의 양쪽인지"를 드러내지 않지만, `16_46_56` RESOLUTION.md INFO #4·`17_14_18`
  maintainability INFO #2 에서 "바로 위 JSDoc 이 표로 설명하므로 이름을 늘리면 중복"이라는
  근거로 의도적으로 유지 결정됐다. 새로운 지적 아님, 재론하지 않는다.
- `mask-sensitive-fields.util.ts` 의 28줄짜리 실측/한계 주석이 `DEFAULT_SENSITIVE_KEYS`
  배열 리터럴 **중간**(`refresh_token` 과 신규 8개 항목 사이)에 끼어 목록 스캔 흐름을 한 번
  끊는 점은 `17_14_18` 라운드가 이미 검토했고, 이 저장소 문서화 관례상 감수할 수준으로 판단해
  별도 항목으로 올리지 않았다. 그 판단을 유지한다 — 새 코드는 없고 위치도 그대로다.

## 요약

이번 diff 는 이전 두 리뷰 라운드가 지적한 실질적 구조 결함(헬퍼 JSDoc 배치, 자매 표면 테스트
비대칭)이 모두 해소됐음을 소스에서 직접 확인했다. 신규 헬퍼 `redactAssistantFields` 는 기존
6줄 중복 호출을 통합했고, 신규 테스트는 기존 스위트와 네이밍·구조가 일관된다. 이번 라운드에서
새로 발견한 것은 헬퍼 재배치가 파일 내 기존 "module-level 헬퍼는 하단" 관례와 미묘하게
어긋난다는 INFO 1건뿐이며, 병합을 막을 수준이 아니다. 함수 길이·중첩·매직 넘버·순환 복잡도
모두 diff 범위 안에서 문제 없다.

## 위험도
LOW
