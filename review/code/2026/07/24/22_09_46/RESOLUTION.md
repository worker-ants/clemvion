# RESOLUTION — review/code/2026/07/24/22_09_46

대상: `claude/webchat-apibase-binding-a14e68` (세션 ↔ 발급 apiBase 바인딩)
결과: **CRITICAL 0 · WARNING 5 · RISK LOW**. forced 7/7 확보(`forced_missing=[]`).

## 조치 항목

| # | 카테고리 | 판정 | 조치 |
|---|---|---|---|
| W1 | Maintainability | **타당 → 수정** | 후행 슬래시 정규화가 3곳(`eia-client.joinUrl`·`use-widget.fetchEmbedConfig`·세션 origin 비교)에 독립 존재 → `lib/api-base.ts` 의 `stripTrailingSlash()` 로 단일화. **경로 보존 이유를 그 모듈에 고정**(origin 만 남기면 `…/api` 와 `…/api-v2` 를 같다고 봐 세션 비교에서 곧 토큰 오전송) |
| W2 | Maintainability | **수용(현행 유지)** | §아래 |
| W3 | **SPEC-DRIFT** | **타당 → 수정** | `spec/7-channel-web-chat/3-auth-session.md` §3.1 필드 열거에 `apiBase` 추가 + "발급 origin 불일치·미기록 시 폐기" + 비교 규칙(후행 슬래시만 정규화, 경로 보존) 명시 |
| W4 | Documentation | **타당 → 수정** | `CHANGELOG.md` 에 기존 관례 톤으로 항목 추가 |
| W5 | Testing | **타당 → 수정** | `use-token-refresh.test.ts` 에 **갱신 후 `apiBase` 보존** 단언 추가. 현재는 spread 로 암묵 보존이라 필드 나열 리팩터 시 조용히 탈락 → 다음 새로고침마다 정상 세션이 리셋되는 회귀가 된다 |
| I5 | Testing | 수정 | 라운드트립 테스트에 `apiBase` 왕복 단언 추가 |
| I7 | Requirement | **반증 — 수정 불요** | §아래 |
| I1~I4·I6·I8~I10 | 각종 | 확인 | 조치 불요(대부분 "선재" 또는 우선순위 낮음). I2(`wc:boot` 스킴 검증)는 이 diff 가 만든 표면이 아니며 후속 검토 대상 |

## I7 — plan 의 mutation 수치(18) vs 리뷰어 실측(17): **내 수치가 맞다**

리뷰어가 "plan 은 18건이라는데 실측 17건" 이라 지적했다. **현 시점에서 다시 측정했고 18건**
이다(2회 확인: `use-widget` 이 잘못된 apiBase 를 넘기도록 변조 → `Tests 18 failed | 382 passed`).
리뷰어 측정은 다른 코드 상태(대조군 테스트 추가 전으로 추정)의 값으로 보인다. plan 수정 불요.

> 수치가 어긋난다는 지적 자체는 옳은 종류의 지적이라, "내가 맞다" 로 끝내지 않고 **재측정으로
> 확인**했다. 근거 없이 방어하면 이 세션이 §C1 에서 저지른 실수의 반복이 된다.

## W2 — 테스트 fixture 인라인 리터럴(19곳) 헬퍼화: 수용(현행 유지)

지적은 타당하다(다른 두 테스트 파일은 이미 `session(overrides)` 헬퍼를 쓴다). 다만 이번 PR 에서
하지 않는다:

- 19곳이 **필드 구성이 제각각**(만료 시각·endpoints·executionId 가 케이스마다 다름)이라 기계적
  치환이 아니라 케이스별 판단이 필요하다. 이 파일은 boot/staleness 축에서 **9번 거울상 결함**을
  낸 자리라(그 이력이 파일 주석에 있다) 대량 치환의 회귀 위험이 이득을 넘는다.
- 이번 diff 가 그 중복을 **만들지 않았다** — 선재 구조이며, 필드 추가로 중복이 드러났을 뿐이다.
- 별건으로 다루는 편이 리뷰 단위도 정직하다(테스트 리팩터 vs 보안 수정).

## TEST 결과

- lint **PASS** · unit **PASS**(14) · build **PASS**
- channel-web-chat **400 passed** (신규 6: store 4 + 위젯 통합 1 + 대조군 1)
- e2e **PASS 259**
- mutation 재확인: apiBase 검사 제거 → 4건 RED / 배선 변조 → **18건 RED**

## 보류·후속 항목

- **W2** 테스트 fixture 헬퍼화 — 별건 권장(위 사유)
- **`4-security.md` 위협 표에 재전송-origin 축 추가** — 위협 모델 편집은 **planner 트랙**
  (신규 요구·결정 서술). §3.1 필드 열거는 구현된 동작의 사실 기술이라 developer sync 로 처리했으나,
  위협 모델은 그 경계 밖이다.
- **I2** `wc:boot` 경로의 `apiBase` 스킴 검증(query-param 폴백엔 있음) — 선재 신뢰 경계, 별건.

---

## 후속 라운드 — consistency `--impl-done` (2026-07-24)

RESOLUTION 작성 시점에 plan 체크박스가 `/consistency-check --impl-done` 을 `[x]` 로 적고 있었으나
**실제로 돌리지 않았다**. push 게이트가 그것을 잡았다("spec-linked 7파일이 최신 impl-done 보고서
이후 변경됨"). 이 저장소가 반복 경계하는 stale 체크박스를 내가 만들었다 — 정정하고 실제 실행했다.

| 라운드 | 결과 |
|---|---|
| `22_35_51` | **BLOCK: YES** — naming_collision CRITICAL 1 + plan_coherence WARNING 2 |
| `22_50_44` | **BLOCK: NO** — Critical/Warning 0 (해소를 코드 직접 확인으로 재검증) |

### CRITICAL — 실질적인 지적이었다

`session-store.normalizeApiBase`(경로 **보존**)가 `app/demo/demo-config.ts::normalizeApiBase`
(후행 `/api` **까지 제거**)와 **정반대 계약으로 동명**이었다. 통합되면 `…/api` 와 `…` 가 같다고
판정돼 **이번 PR 이 막은 cross-origin 토큰 유출이 되살아난다**. W1 에서 `stripTrailingSlash` 를
이미 공용화했으므로 로컬 wrapper 는 불필요 → 제거(잔존 동명 0). 경로 보존 이유 + demo-config
동명 경고를 호출부 주석에 고정.

### WARNING 2건

- **Gate C stale**: plan `spec_impact: none` 이었는데 W3 반영으로 spec 을 실제 편집 → 리스트 교정.
  Gate C 는 형식만 봐서 못 잡는 drift 를 checker 가 잡았다.
- **후속 미착지**: 미룬 2건이 어떤 티켓에도 없었다 → `webchat-boot-apibase-scheme-validation.md`
  신설(developer) + `webchat-spec-rationale-followup.md` 에 3항목 편입(planner: 4-security 위협 축 ·
  R7 Rationale · 2-sdk §3 각주).

### 2R INFO 반영

- `3-auth-session.md` frontmatter `code:` 에 신규 `lib/api-base.ts` 등재(evidence 완결성)
- plan 본문 "**상태**: 미착수" → "완료(2026-07-24)" 자기모순 정정
