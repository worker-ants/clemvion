# RESOLUTION — 아바타 업로드 리뷰 6라운드 반영

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **2** · SPEC-DRIFT 3 · INFO 16

**위험도가 처음으로 LOW 로 내려왔다.** WARNING 2건 모두 저위험이고, 둘 다 실재하며 둘 다
고쳤다. SPEC-DRIFT 3건과 INFO 16건은 전부 리뷰가 "코드 유지 / 조치 불요 / 이미 유예 등재"
로 판정한 것이다.

| 라운드 | 위험도 | Critical | Warning |
|---|---|---|---|
| 1 | HIGH | 2 | 9 |
| 2 | CRITICAL | 1 | 13 |
| 3 | CRITICAL | 1 | 13 |
| 4 | MEDIUM | 0 | 9 |
| 5 | MEDIUM | 0 | 6 |
| 6 | **LOW** | **0** | **2** |

## W1 — 5라운드가 기존 주석을 지우지 않고 같은 내용을 덧붙였다

`ExpressNS` 리네임 근거가 거의 동일한 두 문단으로 중복돼 있었다. 5라운드가 "리네임 근거가
코드에 없다" 는 지적에 대응하며 **이미 있던 문단을 못 보고** 위에 다시 썼다. scope·
maintainability·documentation 3명이 같은 지적을 했다.

하나로 합쳤다 — 근거 설명은 한 번만 두고, 5라운드가 새로 더한 정보(다른 컨트롤러 4곳은
`Express` 그대로, 전역 컨벤션 승격은 `spec/conventions/` 문서화 선행)만 이어 붙였다.

## W2 — 부팅 경고의 조합 판정이 어떤 테스트로도 안 물렸다

리뷰가 `main.ts` 의 조합(`NODE_ENV==='production' && isPrivateHost(resolvePublicBaseUrl(…))`)
을 `if (false && …)` 로 뮤테이션해도 **관련 6개 스펙 85건이 전부 GREEN** 임을 실측했다.
CHANGELOG 가 스스로 "같은 클래스의 근접사고가 있었다" 고 적은 그 회귀를, 정작 아무 테스트도
못 잡고 있었다.

원인은 **판정이 부트스트랩 본문 안에 인라인으로 있었다**는 것이다. `bootstrap()` 은 유닛이
붙잡기 어렵다. 3~5라운드에서 폴백 규칙(`resolvePublicBaseUrl`)은 순수 함수로 뺐으면서
**그 규칙을 쓰는 조합은 안에 남겨 두었다** — 절반만 뺀 셈이다.

조합 전체를 `shouldWarnPublicBaseIsPrivate(env)` 로 옮기고 `main.ts` 는 호출만 한다.
`throw` 가 아니라 `warn` 이라는 **정책 판단은 호출자에 남겼다** — 그건 부트스트랩의 몫이다.

테스트 11건으로 고정했다. 가장 중요한 케이스:

```
두 env 모두 미설정 → 경고한다   // 4라운드까지 사본의 마지막 항이 '' 라 여기서 침묵했다
S3_ENDPOINT 만 사설 → 경고한다  // 공개 base 미설정 시 endpoint 로 폴백하므로
localhost.evil.com → 침묵      // 서브도메인 함정
REPLACE_ME.cloudfront.net → 침묵 // 미치환 sentinel 은 사설이 아니다
```

뮤턴트 S1(`NODE_ENV` 가드 무력화) → **RED 1**, S2(판정을 `false` 로) → **RED 7**.

## SPEC-DRIFT · INFO

SPEC-DRIFT 3건은 리뷰가 "코드 유지, `plan/in-progress/spec-update-avatar-upload-implemented.md`
에 대상 줄 번호와 함께 이미 위임됨" 으로 판정했다. INFO 16건도 전부 조치 불요이거나 이미
유예 등재(매직바이트·TOCTOU·`UserAvatarService` 분리·URL↔key 대칭·`S3Module` 승격)다.

INFO 16(프런트엔드 업로드 UI + 유저 가이드 부재)만 새 성격인데, 이 PR 은 backend 전용이라
"누락" 이 아니라 "아직 미트리거" 다. 리뷰 제안대로 추적 항목을 plan 에 등재했다.

## 뮤테이션 2축 (예측 / 실측 — 전부 RED)

```
S1 NODE_ENV 가드 무력화 (if (false) return false)   RED / RED 1
S2 사설 주소 판정을 false 로                        RED / RED 7
```

## 검증

lint(`--max-warnings 0`) · prettier · backend **439 suites / 9161 passed, 1 skipped** ·
docs 가드 **3104** · e2e.
