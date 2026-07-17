# 변경 범위(Scope) Review 결과

대상: `3b54c8727..HEAD`(커밋 `42e4346cf` fix + `31a7ce4fc` docs). 직전 리뷰(`review/code/2026/07/17/08_29_33`) 의 Critical 2 / Warning 7 에 대한 조치 커밋.

## 검증 방법

프롬프트 payload 의 diff 를 `git diff 3b54c8727..HEAD --stat` / 개별 파일 `git diff` 로 재대조해 (1) 파일 목록 일치, (2) 각 hunk 가 어느 지적(C1/C2/W1~W7)에 대응하는지 1:1 매핑, (3) `import` 변경 유무, (4) 공백만 다른 라인 유무(`git diff -w` 와 정상 diff 비교)를 확인했다. 21개 변경 파일 중 8개가 코드/plan(CHANGELOG·`widget-state.ts`+test·`use-token-refresh.ts`+test·`use-widget-eager-start.test.ts`·`use-widget.ts`·plan 문서), 13개가 `review/code/2026/07/17/08_29_33/` 신규 산출물(직전 리뷰 원본 출력 + `RESOLUTION.md`/`SUMMARY.md`)이며 후자는 별도 커밋(`31a7ce4fc`, `docs(review):` 전용)으로 분리되어 있다. `import` 변경 0건, `git diff -w` 결과가 일반 diff 와 완전히 동일(공백/서식만의 hunk 없음)함을 확인했다.

## 발견사항

- **[INFO]** (a) `useTokenRefresh` 의 `cancelledRef` 제거 + `worldGenRef` 주입 — W5 지적이 제시한 두 옵션 중 더 철저한 쪽을 택한 것, 스코프 내
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts`(인터페이스+구현), `use-token-refresh.test.ts`(mock deps 추가 + 신규 회귀 테스트 1건), `use-widget.ts` L169-179(유일한 호출부 wiring)
  - 상세: 원 W5 지적(`SUMMARY.md` Warning#5, `maintainability.md`)은 "`worldGenRef` 를 주입받아 확장하거나, **최소한** 제외 이유를 문서화" 두 가지를 제안했다. 이번 diff 는 전자를 택해 `cancelledRef` 를 완전히 대체했다. 이는 "확장"을 넘어선 게 아니라 그 두 옵션 중 하나를 문자 그대로 이행한 것이다. `cancelledRef` 를 남겨뒀다면 `worldGenRef`(gen)와 `cancelledRef`(bool) 두 축이 공존해, 이번 리팩터 계열(`3b54c8727`)이 애초에 없애려던 "무효화 트리거 다종화"를 훅 레벨에서 재현했을 것 — 완전 대체가 오히려 목표에 부합하는 최소 변경이다. 건드린 파일도 인터페이스 변경의 불가피한 파급(구현·그 인터페이스를 쓰는 테스트·유일한 호출부) 3곳뿐이고, 그 외 훅의 다른 동작(딜레이 계산·재예약 로직)은 무변경이다.
  - 제안: 없음(정당).

- **[INFO]** (b) 테스트 flush 관용구 일괄 교체(`flushAsync`) — C2 가 인용한 2개 라인구간보다 넓지만, 같은 라운드의 다른 두 지적이 그 넓은 대상을 이미 뒷받침
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 신규 헬퍼 정의 1곳 + 기존 `await Promise.resolve();`(단독 8곳·연속 2회 3곳) 를 `await flushAsync();` 로 치환한 실측 11개 지점 + 신규 테스트(W2·W3·C1) 내 4개 신규 콜사이트
  - 상세: `08_29_33` CRITICAL#2 의 "위치" 필드는 두 라인구간(`:1487-1562`, `:1645-1720`)만 인용했다. 그러나 같은 라운드의 `maintainability.md` INFO(무설명 "2회" 매직넘버) 와 `concurrency.md` INFO 가 동일 관용구를 파일 내 **다른 2곳**(옛 410 응답 테스트, in-flight 명령 dedup 테스트)에서 독립적으로 추가 지적했다 — 즉 이 관용구가 취약하다는 지적 자체는 이미 3인 이상의 리뷰어가 파일 전역에 걸쳐 낸 것이지, C2 하나가 지목한 2곳에 국한되지 않는다. 실측 결과 치환 지점은 11곳(구 라인 14줄 제거, `flushAsync()` 신규 15콜사이트 = 치환 11 + 신규 테스트 4)이며, `RESOLUTION.md`/커밋 메시지의 "12곳" 표기와는 1곳 오차가 있다(사소한 서술 부정확 — 문서 정확성은 documentation 영역이라 본 리뷰에서는 참고로만 기록). 각 치환 hunk 를 직접 대조한 결과 flush 콜 자체 외에 assertion 이나 테스트 로직 변경은 없다(순수 1:1 치환). C2 의 **귀속**(이번 리팩터가 비결정성을 유발했다는 주장)은 동일 조건 85회 재현에서 실패 0건으로 반박됐음에도, 지목된 관용구의 **구조적 취약성**(프로미스 체인 길이를 고정 횟수로 추측)은 반박되지 않았고 남겨두면 향후 프로덕션 await 홉 수 변경 시 조용히 검출력을 잃는다는 점에서 "증명된 버그" 대신 "지적된 코드 냄새"에 대한 선제 조치로 보인다. 프로덕션 코드·다른 파일에는 손대지 않고 이미 이번 fix 가 열어 둔 단일 테스트 파일 안에서만 이뤄졌다.
  - 제안: 조치 불요(스코프 내로 판단). 다만 "12곳" 표기는 실측(11곳)과 어긋나므로 후속 정정을 권장(차단 사유 아님).

- **[INFO]** (c) 리듀서 `widget-state.ts` 가드 추가 — W4 권고 코드를 문자 그대로, 확장 없이 최소 반영
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` L130(신규 1줄 `if (state.phase === "ended") return state;` + 주석) / `widget-state.test.ts`(+28줄, 신규 테스트 2건)
  - 상세: `concurrency.md`/`SUMMARY.md` Warning#4 가 제안한 코드를 `WAITING` 케이스 1곳에만 적용했다. 리뷰어가 "필요 시" 확장 대상으로 함께 언급한 다른 재활성화형 액션(`AI_MESSAGE`/`BOOTED`/`RESTORED`)에는 손대지 않았고, `RESOLUTION.md` W4 절도 `handleEiaEvent` 의 직접 SSE 분기 관련해 "미조치 — 이제 위 리듀서 가드가 그 경로도 함께 덮는다"고 명시해 확장 검토 후 의도적으로 범위를 좁혔음을 기록했다. 요청받지 않은 범위 확장을 하지 않은 사례로, 세 항목 중 가장 교과서적으로 최소 범위다.
  - 제안: 없음.

- **[INFO]** `teardownSession()` 의 `if (configRef.current) clearSession(...)` → 무조건 호출 단순화는 C1 가드의 직접 파생물(드라이브바이 정리 아님)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L198-205
  - 상세: 함수 최상단에 C1 가드(`if (!configRef.current) return;`)가 추가되면서, 그 이후 코드 경로에서는 `configRef.current` 가 non-null 임이 보장돼 기존의 방어적 조건부 `clearSession` 호출이 죽은 분기가 됐다. `RESOLUTION.md` C1 절이 "이 가드로 죽은 코드가 돼 제거"라고 명시적으로 근거를 남겼다 — C1 fix 가 유발한 필연적 파생 정리이지, 별개의 리팩터링이 슬쩍 끼어든 것이 아니다.
  - 제안: 없음.

- **[INFO]** 리뷰 산출물과 코드 fix 가 커밋 단위로 깔끔히 분리됨
  - 위치: 커밋 `42e4346cf`(코드 fix, 8 파일 — CHANGELOG·`widget-state.ts`+test·`use-token-refresh.ts`+test·`use-widget-eager-start.test.ts`·`use-widget.ts`·plan 문서) vs `31a7ce4fc`(`review/code/2026/07/17/08_29_33/*.md` 등 13 파일, `docs(review):` 전용)
  - 상세: 프롬프트 payload 는 두 커밋을 하나의 diff 로 묶어 제시했지만, 실제 히스토리는 코드 fix 와 (직전 라운드의 원본 산출물 + `RESOLUTION.md`/`SUMMARY.md`) 아카이빙이 별개 커밋으로 나뉘어 있다. `review/code/**` 산출물 보관은 CLAUDE.md 컨벤션과 일치하고, 마지막을 `review/**` 전용 커밋으로 종결하는 관행은 리뷰 게이트 재무장을 피하는 데도 유리하다.
  - 제안: 없음(모범적 커밋 위생).

## 요약

이번 diff 는 직전 리뷰(`08_29_33`)의 Critical 2 건과 Warning 7 건 전부에 대해 1:1 로 추적 가능한 코드/테스트 변경을 담고 있으며, `RESOLUTION.md`·`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 가 각 항목의 재현·귀속·mutation 검증 근거를 남겨 "지적 대응"이라는 명분이 실제 diff 와 정합한다. 사용자가 특히 지목한 세 지점 중 (a) `cancelledRef`→`worldGenRef` 교체와 (c) 리듀서 가드는 각각 W5·W4 가 제시한 코드를 그대로, 오히려 절제된 범위로 구현했고, (b) 테스트 flush 관용구 일괄 교체는 C2 가 인용한 2곳보다 넓은 11곳을 건드렸으나 같은 라운드의 다른 두 독립 지적(maintainability/concurrency)이 이미 그 넓은 대상을 정당화하며, 프로덕션 코드나 무관한 파일로 새지 않고 순수 1:1 치환(로직·assertion 불변)임을 hunk 단위로 확인했다. 그 외 `teardownSession` 의 사소한 죽은 코드 정리도 C1 가드의 직접 파생물로 근거가 남아 있다. `git diff --stat`/`git diff -w` 대조 결과 21개 파일 중 8개 실질 변경분 밖에는 무관한 파일·import·순수 포맷팅 변경이 전혀 없었고, 나머지 13개는 컨벤션에 맞는 리뷰 산출물 아카이빙으로 별도 커밋에 격리돼 있다. 전반적으로 "리뷰 지적 대응"을 명분으로 한 은폐된 확장은 발견되지 않았으며, 유일하게 논쟁 여지가 있는 (b) 도 근거·안전성(치환이 곧 상위집합 flush 라 기존 검출력을 잃지 않음)이 문서화돼 있어 차단 사유가 아니다.

## 위험도

LOW
