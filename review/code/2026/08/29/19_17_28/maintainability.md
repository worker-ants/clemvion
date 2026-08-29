# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 봉투 키 닫힌 집합 배열 `['code', 'message', 'requestId']` 이 같은 `describe` 블록 안에서 두 번 그대로 반복된다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts:356-360` (it.each 본문) 와 `codebase/backend/src/common/filters/http-exception.filter.spec.ts:371-375` (비-Error fallthrough 케이스)
  - 상세: 두 자리 모두 "봉투 `error` 의 키는 이 세 개뿐" 이라는 같은 불변식을 같은 리터럴 배열로 단언한다. 지금은 두 곳뿐이라 drift 위험이 작지만, 이 파일이 이미 "축이 enumerable own key 인 이유" 문단을 중복 없이 정본 한 곳으로 모으는 정리를 하는 PR(파일 2·4·7)이라는 점에서 이 두 리터럴도 같은 정리 대상 후보다.
  - 제안: `const CLOSED_ENVELOPE_KEYS = ['code', 'message', 'requestId'];` 로 모듈 상단에 상수화해 두 자리에서 재사용.

- **[INFO]** Logger spy 무음화(`jest.spyOn(Logger.prototype, 'error'|'warn').mockImplementation(() => undefined)`) 보일러플레이트가 신설 `describe` 블록 안에서 4번 반복된다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts:267`, `:299`, `:346-351`(error+warn 두 줄)
  - 상세: 매번 동일한 두 줄 패턴(`jest.spyOn(...).mockImplementation(() => undefined)`)을 케이스마다 새로 쓴다. 파일 상단에 이미 `mockHost()`/`bodyOf()` 같은 공용 헬퍼가 있는 것과 대비된다.
  - 제안: `function silenceLogger(...levels: Array<'error' | 'warn'>): void { levels.forEach((l) => jest.spyOn(Logger.prototype, l).mockImplementation(() => undefined)); }` 같은 헬퍼로 추출하면 4곳이 1줄씩으로 줄고, 의도("이 테스트는 로그 잡음을 의도적으로 죽인다")도 더 명시적이 된다. 다만 규모가 작아 필수는 아니다.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md`, `plan/in-progress/deps-peer-gating-and-eslint10.md` 두 트래커 문서가 다단계 blockquote 정정(`>`·`>>`·`>>>` 층층이 중첩된 "정정의 정정")으로 계속 누적되며 55KB급으로 커졌다
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md` §체크리스트 하단(`3179`~`3326` 부근, 4~5단계 중첩 blockquote) / `plan/in-progress/backend-lint-gate-broken-on-main.md` 581행 이하 신규 추가분
  - 상세: 이번 diff 자체는 각 문서에 실측 표·근거를 성실히 덧붙이는 정상적인 편집이지만, 문서 구조 자체가 "정정 위에 정정" 을 무한히 쌓는 형태라 다음 사람이 "지금 유효한 결론이 어느 블록인지" 를 찾으려면 문서 전체를 순서대로 읽어야 한다(이 리뷰에서도 프롬프트 크기 제한으로 이 두 파일의 전체 컨텍스트를 한 번에 못 실었을 정도). 코드 리뷰 범위는 아니지만 이 두 파일이 리뷰 대상으로 명시됐고, 팀 메모리(`feedback_stale_plan_claims_and_checklist_sync.md` 등)도 이 저장소가 이 패턴으로 반복 실수를 겪었음을 기록하고 있다.
  - 제안: 새 기능 요구는 아니지만, 문서가 `complete/` 로 이동하기 전에 "현재 유효한 결론" 요약 섹션을 상단에 한 번 두는 것을 고려할 만하다(각주 형태의 정정 이력은 그대로 두되).

## 요약

이번 변경분의 실질 코드 표면은 좁다 — 신규 순수 로직은 `redis-fail-open-catalog-guard.ts`(AST 파서, 함수당 책임이 명확하고 이름이 목적을 잘 드러내며 중첩·길이 모두 양호) 하나뿐이고, 나머지는 그 소비 테스트(`redis-fail-open-catalog.spec.ts`)와 기존 `cause` 비노출 불변식 관련 spec 5곳에 대한 주석 정리·테스트 추가다. 정리 diff(파일 2·3·4·7)는 오히려 중복 서술을 정본 한 곳으로 모아 drift 를 줄이는 방향이라 유지보수성을 개선한다. `http-exception.filter.spec.ts` 신설 블록은 매우 상세한 근거 주석과 vacuity 방지 장치를 갖췄으나, 봉투 키 배열과 Logger spy 무음화 보일러플레이트가 소규모로 반복되는 점은 사소한 DRY 여지다. plan 문서 두 건은 다단계 중첩 정정으로 계속 커지고 있어 장기적으로 탐색성이 떨어질 우려가 있으나 이번 PR 만의 결함은 아니다. 전반적으로 네이밍·함수 길이·중첩 깊이·매직 넘버 모두 양호하고 기존 코드베이스 컨벤션(정규식 대신 AST, 정본 SoT 참조, scratch 디렉터리 사용)과 일관되다.

## 위험도

LOW
