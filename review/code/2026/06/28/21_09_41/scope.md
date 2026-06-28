# 변경 범위(Scope) 리뷰

## 발견사항

변경 의도: 공개 webhook IP 미식별 시 `if (!ip) return true` fail-open 우회를 단일 공유 버킷(`UNIDENTIFIED_IP_BUCKET`) 완화 한도로 교체 (D-12).

### 코드 변경 (파일 1~4)

- **[INFO]** 주석 분량 증가 — 의도된 기술 부채 해소
  - 위치: `public-webhook-throttle.guard.ts` 98~225행 블록 주석
  - 상세: `if (!ip) return true` 제거 대신 `?? UNIDENTIFIED_IP_BUCKET` 한 줄로 교체하면서 결정 근거(D-12·W1/W3·socket 폴백 기각·spec SoT)를 7행 주석으로 추가. 주석이 늘었으나 이전 WARNING#15/권장7 에서 "설계 의도 불명확" 지적을 받은 코드라 근거 명문화가 타당함. 불필요한 주석 추가로 보기 어렵다.
  - 제안: 없음.

- **[INFO]** `makeMinKey`/`makeHourKey` JSDoc 단 문구 수정
  - 위치: `public-webhook-quota.service.ts` 94~97행
  - 상세: "IP 별" → "IP 별, 또는 `UNIDENTIFIED_IP_BUCKET` sentinel" 로 확장. sentinel 을 인자로 받는 것이 의도임을 명시한 것으로 일관성 검토(I-8)에서 권고한 사항이다. 범위 내 최소 수정.
  - 제안: 없음.

- **[INFO]** 임포트 변경 — 필요한 추가
  - 위치: `public-webhook-throttle.guard.ts` 194~198행, `public-webhook-throttle.guard.spec.ts` 132~136행
  - 상세: 기존 단일 임포트를 multi-line 임포트 블록으로 바꾸고 `UNIDENTIFIED_IP_BUCKET` 을 추가. 코드에서 실제로 사용하는 상수이므로 필요한 추가다.
  - 제안: 없음.

### 테스트 변경 (파일 1, 3)

- **[INFO]** 기존 테스트 케이스 명칭 및 어서션 수정
  - 위치: `public-webhook-throttle.guard.spec.ts` 144~156행
  - 상세: "IP 식별 불가 → 통과(추적 불가 fail-open)" 케이스 이름을 변경하고 `expect(quota.consumeStart).not.toHaveBeenCalled()` → `expect(quota.consumeStart).toHaveBeenCalledWith(UNIDENTIFIED_IP_BUCKET)` 로 수정. 기존 동작이 새 동작으로 바뀌었으므로 테스트 갱신이 필수다. 범위 내.
  - 제안: 없음.

### spec 변경 (파일 22~25)

- **[INFO]** `spec/5-system/1-auth.md` §2.3 표 및 Rationale 2.3.B m-3 갱신
  - 위치: lines 318~321, 659~170
  - 상세: §2.3 표 "클라이언트 IP" 셀에 공유 버킷 완화 한도 한 줄 추가, Rationale m-3 말미에 socket 폴백 기각 + 공유 버킷 귀결 문장 추가. plan S-4 에 명시된 예정 변경이다.
  - 제안: 없음.

- **[INFO]** `spec/5-system/12-webhook.md` WH-SC-05 및 §6·§8 갱신
  - 위치: WH-SC-05 행, §6 Rate Limiting 불릿, §8 Rate Limiting 행
  - 상세: sentinel 공유 버킷 동작·WH-SC-09 경계 한 줄 추가. plan S-3 예정 변경.
  - 제안: 없음.

- **[INFO]** `spec/5-system/3-error-handling.md` 에러 코드 설명 갱신
  - 위치: lines 2235~2238
  - 상세: `PUBLIC_WEBHOOK_RATE_LIMIT`/`PUBLIC_WEBHOOK_HOURLY_LIMIT` 설명에 "또는 IP 미식별 시 공유 버킷" 구문 추가. impl-prep 검토 W-1 에서 필요로 지정된 변경.
  - 제안: 없음.

- **[INFO]** `spec/7-channel-web-chat/4-security.md` §4 불릿 + blockquote + R3 보강 + R6 신설
  - 위치: §4 IP rate-limit 불릿, blockquote(결정 1 인프라 권고), R3 말미, R6 전체(31행)
  - 상세: plan S-1(§4 불릿·blockquote), S-2(R6 신설, R3 에 R6 포인터). --spec 검토 W-1 에서 R3 충돌을 피해 R6 분리로 결론 내린 사항이며, R3 에는 포인터만 추가.
  - 제안: 없음.

### plan 갱신 (파일 5)

- **[INFO]** `plan/in-progress/webhook-public-ip-failopen-hardening.md` 대폭 확장
  - 위치: 전체 diff (1~69행 대체)
  - 상세: plan 자체가 이 작업의 추적 문서다. "결정 필요 → 결정 확정", "후속 → 설계+Phase" 로 내용 갱신. `worktree: (unstarted) → webhook-public-ip-failopen-3800c4` 교체(착수 시 규약 교체). CLAUDE.md `plan/in-progress/` 쓰기 권한 범위 내.
  - 제안: 없음.

### consistency 검토 산출물 (파일 6~21)

- **[INFO]** `review/consistency/2026/06/28/20_18_33/`·`20_32_34/` 산출 파일들 신규 추가
  - 위치: SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md (각 2세트)
  - 상세: 정해진 `review/consistency/` 경로에 consistency-check 워크플로 산출물이 저장된 것. CLAUDE.md "일관성 검토 산출물 → `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 규약 준수. 변경 의도 범위 내.
  - 제안: 없음.

## 요약

이번 변경은 plan D-12(공개 webhook IP 미식별 fail-open 강화)에 명시된 두 구현 항목(I-1: sentinel 상수 export, I-2: guard null-IP → 공유 버킷 라우팅)을 정확히 충족한다. 코드 변경 4개 파일은 전부 `codebase/backend/src/modules/hooks/` 내에 한정되어 있으며, 관련 없는 파일·리팩토링·불필요한 기능 확장은 없다. spec 변경(파일 22~25)은 plan Phase A S-1~S-4 에 열거된 예정 변경이고, plan 파일 자체는 착수·결정 확정을 반영한 적법한 갱신이다. 포맷팅·공백 전용 변경은 없으며, 추가된 주석은 일관성 검토 권고사항과 보안 결정 근거를 명문화한 것으로 타당하다. 모든 변경이 선언된 범위 경계("동시 ≤3 캡 비목표", "인프라 WAF 구성 범위 밖")를 준수한다.

## 위험도

NONE
