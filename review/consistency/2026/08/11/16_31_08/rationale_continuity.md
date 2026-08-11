# Rationale 연속성 검토 — webchat-boot-apibase-scheme-validation (재검토, 라운드 5 델타 `9416da806`)

## 검토 범위

본 라운드는 orchestrator 지시에 따라 다음 3가지만 재검증한다(신규 전면 재스캔이 아니라
직전 라운드 발견의 후속 처분 검증):

1. 직전 라운드 INFO 3번째 복제본(`use-widget.test.ts:15`, `direct-load 외부 입력 방어`) 처분 여부
2. 네 번째 복제본 존재 여부(의미 기준 재스캔) + `use-widget-eager-start.test.ts:4248` · `api-base.ts:5` 재판정
3. `plan/complete/webchat-boot-apibase-scheme-validation.md` 회고 절의 "#384 유래" / "처음부터 틀린 주석" 판정이 실측과 일치하는가

## 발견사항

### 1. 3번째 복제본 처분 확인 — 완료

`use-widget.test.ts:15` 직전 텍스트:

```
- 쿼리 apiBase 하드닝 — http(s) 스킴만 허용(direct-load 외부 입력 방어).
+ 쿼리 apiBase 하드닝 — http(s) 스킴만 허용. **direct-load 전용 방어가 아니다**: 이 경로는
+ 정상 임베드에서도 발동한다(`4-security.md §1`).
```

커밋 `9416da806`(`fix(webchat): "정확히 2곳" 이 틀렸다 — 문자열을 셌지 뜻을 세지 않았다`)에서
처분됨. `4-security.md §1`(§R7 반영) 및 `2-sdk.md` §1 표의 현재 서술("쿼리 경로를 '호스트 없는
직접 로드/샘플 전용' 으로 읽으면 안 된다")과도 정합한다. **재발 없음.**

- **[INFO]** 4번째 복제본 — `api-base.ts:5` 의 "direct-load 쿼리 하드닝" 참조 명칭이 정정 이전 프레이밍을 아직 지칭
  - target 위치: `codebase/channel-web-chat/src/lib/api-base.ts:1-7`(`stripTrailingSlash` 헤더 주석), 특히 5번 줄 `(direct-load 쿼리 하드닝 참고)`
  - 과거 결정 출처: `spec/7-channel-web-chat/4-security.md` §R7(`apiBase` 스킴 검증을 **두 경로 모두**에 거는 이유, 2026-08-11 신설) + 같은 세션에서 처분된 3건의 자매 주석(`use-widget.ts` `configFromQuery` JSDoc·직접 로드 폴백 호출부·`use-widget.test.ts:15`)
  - 상세: 본 PR 은 "쿼리 경로 하드닝을 'direct-load 전용' 으로 읽는" 프레이밍이 코드 곳곳(`configFromQuery` JSDoc, 직접 로드 폴백 호출부, `safeApiBaseFromQuery` 관련 테스트 주석)에 복제돼 있던 것을 라운드 4~5 에 걸쳐 전부 "두 경로 모두에 발동" 으로 정정했다(diff 확인). 그런데 같은 개념(경로 보존 규칙)을 참조하는 `api-base.ts:5` 는 이 PR 의 diff 에 포함되지 않아 **여전히 옛 명칭("direct-load 쿼리 하드닝")으로 그 규칙을 가리킨다.** `git grep -n "direct-load\|직접 로드"` 로 `codebase/channel-web-chat/` + `codebase/packages/web-chat-sdk/` 전수 재스캔한 결과 이 한 곳만 남아 있음을 확인했다. 명시적 "이 경로에만 적용된다" 는 배타성 주장은 없어(직전 라운드 판정대로) 기능적 위험은 없지만, R7 이 확립한 "비대칭 프레이밍 자체가 위험하다" 는 원칙과 이름이 어긋난다 — 훗날 이 주석을 따라간 개발자가 "direct-load 전용 개념"으로 오인해 boot 경로에 대한 대칭 처리를 다시 흐트러뜨릴 여지가 있다.
  - 제안: `(direct-load 쿼리 하드닝 참고)` → `(safeApiBase 의 경로 보존 규칙 참고, 4-security.md §R7)` 등으로 갱신해 R7 이 확립한 "두 경로 모두" 프레이밍과 이름을 맞춘다. 라운드 4~5 처분과 같은 커밋 스타일로 처리 가능한 1줄 편집.

- **[INFO]** `use-widget-eager-start.test.ts:4248` — 재판정 결과 위험 없음(직전 판정 유지)
  - target 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:4247-4248`
  - 상세: `"같은 파일의 'host 없이 직접 로드' 폴백(...)이 boot 과 무관하게 쿼리만으로 부팅해 버려"` — 이는 실제로 존재하는 별개의 코드 경로(`configFromQuery` 직접 폴백, `bridge.onBoot` 과 무관하게 마운트 시 즉시 실행)를 가리키는 **정확한 서술**이다. "이 하드닝이 direct-load 전용이다" 라는 배타성 주장이 아니라 "이 테스트가 어느 함수 호출을 겨냥하는지"를 설명하는 문맥이며, R7·수정된 JSDoc과 모순되지 않는다. 재확인 결과 발견사항 없음 — 직전 라운드의 "배타성 주장 없어 위험 낮음" 판정이 맞다.

- **[INFO]** plan 회고 절의 "#384 유래" 판정 — 핵심 사실은 실측과 일치하나, 라운드 5 문단 배치가 과도한 일반화로 읽힐 여지
  - target 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md` "## 라운드 2~5" 절, "**출처는 최초 위젯 PR #384 다.**" 문단(커밋 `9416da806`)
  - 과거 결정 출처: 커밋 `a652f8733`(#384) — `configFromQuery` JSDoc("host 없이 직접 로드/샘플 대비") + 직접 로드 폴백 호출부 주석("host 없이 직접 로드(샘플/개발)") + SDK `resolveIframeTarget`(`bridge.ts`)이 **동일 커밋**에서 함께 도입됨을 `git log -S "직접 로드" -- .../widget/`·`git show a652f8733:.../use-widget.ts`로 독립 재확인했다. 또한 `df1375208`(라운드 4) 직전(`df1375208~1`)까지 이 두 주석의 텍스트가 a652f8733 당시와 **글자 하나 다르지 않게** 유지됐음도 확인 — "그 사이 어떤 커밋도 서술을 바꾸지 않았다"는 이 두 주석에 한해 정확하다.
  - 상세: 다만 라운드 5(`9416da806`)가 실제로 고친 **세 번째 복제본**(`use-widget.test.ts:15`, `"direct-load 외부 입력 방어"`)의 **정확한 문자열**은 `git log --all -S "direct-load 외부 입력 방어"` 로 재검색하면 a652f8733 이 아니라 `aba46cc90`(#761, `safeApiBaseFromQuery` 함수 자체가 신설된 커밋)에서 처음 등장한다. 즉 "#384 유래"는 **개념적 오프레이밍의 뿌리**(a652f8733 이 심은 "쿼리=직접로드 전용" 이라는 사고, `configFromQuery`/호출부 주석 2건)에는 정확히 들어맞지만, 라운드 5 절 바로 앞 문단이 논의하는 **그 세 번째 복제본의 문자 그대로의 저작 시점**은 #761 이다(라운드 4 처분 이후 새 함수를 추가하며 인접한 옛 프레이밍을 그대로 이어받아 재작성한 것으로 보임 — copy-paste 파생이 아니라 같은 오해의 **독립 재-저술**). 회고 절이 두 사실(개념적 뿌리=#384, 문자열 자체의 저작=#761)을 한 문단에 뭉뚱그려 "출처는 #384" 라고만 적어, 이후 이 문단만 보고 세 번째 복제본을 직접 `git log -S`로 재검증하려는 사람이 다른 커밋(#761)을 만나 "회고가 틀렸다"고 오판할 여지가 있다. 이는 실제 결정을 왜곡한 것은 아니고(핵심 인과관계 — #384 가 뿌리, 파생 프레이밍이 세션 내내 정정 없이 이어짐 — 는 맞다) 귀속 정밀도의 문제다.
  - 제안: 회고 절에 한 문장만 추가해 구분한다 — 예: "정확히는 `configFromQuery` JSDoc·직접 로드 폴백 주석 2건이 #384(a652f8733) 원본이고, 세 번째 복제본(`use-widget.test.ts` 의 `direct-load 외부 입력 방어`)은 `safeApiBaseFromQuery` 신설 커밋(#761)에서 같은 프레이밍을 독립적으로 재-저술한 것 — 문자열 계보가 아니라 오해의 계보가 #384 로 이어진다." 필수 수정은 아니며(핵심 판정은 유효), 다음에 같은 회고를 남길 때 "출처" 라는 단어가 "문자열 최초 등장 커밋"과 "개념의 최초 등장 커밋"을 혼용하지 않도록 하는 정밀화 제안이다.

## 요약

라운드 4~5 에서 반복 정정된 "쿼리 apiBase 하드닝 = direct-load 전용" 오프레이밍은 `spec/7-channel-web-chat/4-security.md` §R7(2026-08-11 신설, "기각한 대안" 포함)과 `2-sdk.md` §1 표에 정합하게 반영됐고, 지목된 3번째 복제본(`use-widget.test.ts:15`) 처분도 실제로 완료됐다. 코드베이스 전수 재스캔(`직접 로드`/`direct-load` 키워드, 의미 기준) 결과 `api-base.ts:5`에 같은 오프레이밍을 지칭하는 이름("direct-load 쿼리 하드닝")이 배타성 주장 없이 잔존해 있어 네 번째 처분 대상으로 제안하되, 기능적 위험은 없어 INFO 로 유지한다. `use-widget-eager-start.test.ts:4248`은 실제 다른 코드 경로를 정확히 서술하고 있어 재판정에서도 위험 없음이 확인됐다. plan 회고의 "#384 유래" 판정은 핵심 인과관계(원본 두 주석 + `resolveIframeTarget`이 a652f8733 에서 함께 태어났고 라운드4 전까지 무변경)는 독립 재검증으로 사실임이 확인됐으나, 라운드 5 절에 인접 배치되며 세 번째 복제본 고유의 문자열 저작 시점(#761)과 뭉뚱그려질 여지가 있어 정밀화를 제안한다. 두 사안 모두 결정의 왜곡이나 원칙 위반이 아니라 문서 정밀도 보완 수준이라 CRITICAL/WARNING 은 없다.

## 위험도

LOW

BLOCK: NO
STATUS: OK
