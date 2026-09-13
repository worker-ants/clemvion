# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** "정규식 lastIndex 리셋 + while-exec" 보일러플레이트가 한 파일 안에서 4회 반복된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:152-158`(`scanIdentifierCitations` 내부 `push` 헬퍼) · `:178-184`(`collectSourceTokens`) · `:211-217`(`collectEnvDeclarations` 의 `envLine` 루프) · `:219-225`(같은 함수의 `composeLine` 루프)
  - 상세: 네 곳 모두 `rx.lastIndex = 0; let m: RegExpExecArray | null; while ((m = rx.exec(text)) !== null) { … add(m[1]) … }` 형태를 거의 그대로 복제한다. 세 함수(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`)는 서로 다른 정규식·수집 대상을 다루지만 "global 정규식을 재사용 전에 `lastIndex` 를 수동으로 0 으로 되돌려야 한다"는 동일한 함정을 각자 떠안고 있다 — 하나라도 이 리셋 줄을 빠뜨리면(정규식 인스턴스가 함수 스코프 밖에서 재사용되는 구조라 충분히 일어날 수 있는 실수다) 두 번째 반복부터 매치가 조용히 누락되는데 어떤 테스트도 "리셋 생략" 자체를 표적으로 겨누지 않는다.
  - 제안: ES2020 의 `String.prototype.matchAll` (또는 `[...text.matchAll(rx)]`)로 바꾸면 `lastIndex` 를 손으로 관리할 필요가 사라지고 네 곳의 반복 패턴이 한 줄짜리 관용구로 줄어든다. 최소한 `function collectMatches(texts: readonly string[], rx: RegExp): string[]` 같은 공유 헬퍼로 추출해 리셋 로직을 한 곳에 모으는 것만으로도 재발 표면을 4곳에서 1곳으로 줄일 수 있다.

- **[INFO]** 같은 파일 안에서 "실측값을 주석에 남기는" 관례가 세 번째 테스트에서만 깨진다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:112-118` (`"세 축이 모두 후보를 낸다 (축이 조용히 죽는 것 방지)"`)
  - 상세: 같은 파일의 다른 vacuity-floor 단언들(`:75` `mdxFiles.length > 50 // 실측 92`, `:76` `sourceTexts.length > 500`, `:77` `sourceTokens.size > 800 // 실측 1,743종`, `:89` `envOnly.length > 5 // 실측 21종`)은 하나같이 실제 측정값을 주석으로 병기해 "이 숫자가 왜 이 값인가"를 다음 사람이 재측정하지 않고도 알 수 있게 해 두었다. 그런데 `byAxis("field-table") > 10` · `byAxis("code-field") > 0` · `byAxis("backtick") > 100` 세 단언에는 그런 주석이 없다. 코드 자체의 결함은 아니지만, 한 파일 안에서 관례가 국지적으로 깨지면 다음 사람이 "여기는 왜 실측값을 안 적었지 — 일부러 뺀 건가"를 다시 추적해야 한다.
  - 제안: 세 단언 옆에도 실제 축별 카운트를 `// 실측 N` 형태로 병기해 파일 내 일관성을 맞춘다.

- **[INFO]** 테스트 파일이 scan.ts 의 모듈-비공개 정규식과 동일한 이름·패턴을 독립적으로 재정의해 이름이 충돌한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:187` (`const FIELD_TABLE_NAME = /\{\s*name:\s*"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)"/;`) vs `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:102` (`const FIELD_TABLE_NAME = new RegExp(...)`, export 되지 않음)
  - 상세: 두 상수는 이름이 완전히 같고(`FIELD_TABLE_NAME`) 패턴도 우연히 동일하지만 역할은 다르다 — scan.ts 쪽은 **현재 구현**이고, 테스트 쪽은 주석이 설명하듯 `#1330` 의 **문맥-게이팅 축이 있었다면 어떻게 됐을지를 재현하는 역사적 스냅샷**이다(의도적으로 `UPPER_SNAKE` 를 import 하지 않고 문자열을 손으로 복제했다 — scan.ts 가 이 상수를 export 하지 않으므로 애초에 import 할 수도 없다). 의도는 이해되지만, 같은 저장소에서 같은 이름의 상수를 grep 하면 서로 다른 두 정의가 걸려 어느 쪽이 "진짜"인지 헷갈릴 수 있고, 훗날 scan.ts 의 `UPPER_SNAKE` 패턴이 바뀌어도 이 복제본은 조용히 안 따라간다(다만 이 테스트의 목적상 "옛 패턴 고정"이 맞는 선택이라 나쁜 것은 아니다).
  - 제안: 변수명을 `LEGACY_FIELD_TABLE_NAME` 등으로 바꿔 "현재 구현이 아니라 과거 스냅샷"임을 이름에서부터 드러내면 grep 혼동을 없앨 수 있다.

## 요약

핵심 로직(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`)은 순수 함수·낮은 순환 복잡도·얕은 중첩을 유지하며, 세 정규식 축 모두 `UPPER_SNAKE` 공유 패턴을 재사용해 정의 자체의 중복은 없다. 매직 넘버는 대부분 "실측 N" 주석으로 근거가 남아 있어 이 코드베이스의 확립된 관례(가드 테스트에 측정값을 병기)를 잘 따른다. 다만 정규식 매칭 루프(`lastIndex` 리셋 + while-exec)가 한 파일 안에서 네 번 손으로 복제돼 있어 `matchAll` 등으로 단순화할 여지가 있고, 축-카운트 하한선 세 곳만 실측값 주석이 빠져 파일 내부 일관성이 국지적으로 깨진다. 테스트 파일이 과거 정규식을 재현하며 scan.ts 의 모듈-비공개 상수와 이름이 충돌하는 점도 사소하지만 grep 혼동 소지가 있다. 세 항목 모두 동작에 영향을 주지 않는 낮은 비용의 개선 대상이며, 그 외 네이밍·함수 길이·중첩 깊이·전반적 가독성은 이 코드베이스의 자매 가드 파일들과 일관되게 양호하다.

## 위험도

LOW
