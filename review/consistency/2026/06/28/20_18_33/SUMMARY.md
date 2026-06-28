# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. Phase A spec 작성을 진행해도 무방하다.

## 전체 위험도
**LOW** — 5개 checker 전원 LOW 판정. 직접 모순·차단 사유 없음. 실행 시 아래 WARNING 2건을 선처리하면 된다.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Naming Collision | `spec/7-channel-web-chat/4-security.md` 에 `### R3` 가 이미 존재하는데 plan S-2 가 동일 레이블로 신규 절 추가를 지시 — 앵커 충돌 | plan S-2, `4-security.md Rationale R3` | `4-security.md` line 191 `### R3. 남용 방어 rate-limit — fixed-window + fail-open` | S-2 작성 시 기존 R3 에 공유 버킷·socket 폴백 기각 내용을 **인라인 병합**하거나, 신규 절을 `### R4` (또는 다음 번호)로 배정 |
| W-2 | Convention Compliance | plan frontmatter 의 `branch:` 필드가 plan-lifecycle §4 스키마에 열거되지 않은 임의 필드 | frontmatter `branch: claude/webhook-public-ip-failopen-3800c4` | `.claude/docs/plan-lifecycle.md §4` 허용 필드 목록 | `branch:` 제거(worktree 명에서 유도 가능하여 중복 정보). 반드시 기재해야 한다면 plan-lifecycle §4 에 관례 추가 후 사용 |

> W-2 보충: `worktree` 필드는 실착수 slug 로 이미 정상 교체된 상태(`webhook-public-ip-failopen-3800c4`)이므로 sentinel 미사용 자체는 규약 위반이 아니다 — 추가 조치 불필요.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | 공유 버킷 SoT 분산 가능성 — `4-security.md §4`(정책 SoT) 와 `12-webhook.md §6`(구현 SoT) 역할 분리가 의도된 것임을 명시해야 혼동 방지 | plan S-1, `4-security.md §4` + `12-webhook.md §6` | S-1 문구 또는 `12-webhook.md §6` 에 단방향 forward-ref 추가 |
| I-2 | Cross-Spec | `4-security.md §4` 의 "/IP" 표기와 공유 버킷 설명이 나란히 놓일 때 독자 혼동 가능 | plan S-1, `4-security.md §4` line 128 | "IP 식별 가능 시 per-IP 한도, 미식별 시 단일 공유 버킷(동일 fixed-window 한도)" 명확 기재 |
| I-3 | Cross-Spec | WH-SC-09(인증 webhook ip_whitelist fail-closed) 와 공개 webhook rate-limit fail-open 의 적용 조건 대비 명시 권장 | plan S-3, `12-webhook.md` WH-SC-05 갱신 | WH-SC-05 보강 시 "공개 webhook IP 미식별 → 공유 버킷 / 인증 webhook ip_whitelist IP 미식별 → 거부(WH-SC-09)" 구분 한 줄 추가 |
| I-4 | Rationale Continuity | plan 의 "§4 철학" 약칭이 `4-security.md §4 Rationale R3` 임을 spec 작성 시 명시적 cross-ref 로 보완 필요 | plan 결정 3, S-2 | S-2 작성 시 `spec/7-channel-web-chat/4-security.md Rationale R3` 와 `spec/5-system/12-webhook.md Rationale "fail-open + error 로깅"` 명시 인용 |
| I-5 | Rationale Continuity | 기존 R3 병합 확장 시 "fail-open(`return true`)에서 완화 한도(공유 버킷)로의 전환"이 R3 fail-open 정신과 충돌하지 않음을 명시 | plan S-2(R3 또는 R4 작성 시) | "무제한 → 유한 상한"으로의 강화임을 R 항목 서두에 명기 |
| I-6 | Rationale Continuity | S-4(`1-auth.md 2.3.B m-3`) 보강 시 `req.socket.remoteAddress` 와 `req.ip` 모두 기각됨을 명시 | plan S-4, `1-auth.md` Rationale 2.3.B m-3 | 기존 문단 마지막에 "null-IP → 공유 버킷 완화 한도 + 4-security R3(또는 R4) cross-ref" 1문장 추가 |
| I-7 | Plan Coherence | 결정 1(WAF/Ingress 권고) 의 spec 기재 위치가 Phase S-* 에 명시되지 않아 구현 단계 누락 가능 | plan §결정 1 / Phase A S-1 | S-1 또는 별도 S-1b 로 "WAF/Ingress 권고 기재 위치(4-security §4 blockquote 또는 별도 subsection)" 명시화 |
| I-8 | Naming Collision | sentinel 상수 `UNIDENTIFIED_IP_BUCKET` / `'__no_client_ip__'` 는 기존 코드와 충돌 없음. Redis 키(`wh:rl:min:__no_client_ip__`)가 로그·메트릭에서 이상 IP 오분류 가능 | plan 설계 §sentinel 상수, `public-webhook-quota.service.ts` | `makeMinKey`/`makeHourKey` JSDoc 또는 `consumeStart` 시그니처에 "sentinel 포함 가능" 한 줄 기재 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 기존 spec 과 직접 모순 없음. WH-SC-09 fail-closed vs 공개 webhook fail-open 적용 조건 분리 명시 권장 |
| Rationale Continuity | LOW | 핵심 두 결정(socket 폴백 기각, fail-closed 기각) 모두 기존 Rationale 계승. 신규 공유 버킷 결정은 S-2 에서 Rationale 명문화 예정 |
| Convention Compliance | LOW | Critical 위반 없음. `branch:` 임의 필드(WARNING) + `worktree` sentinel 이미 정상 교체 확인 |
| Plan Coherence | LOW | 결정·설계 충돌 없음. 결정 1 WAF/Ingress 권고의 spec 기재 위치 미지정(INFO) |
| Naming Collision | LOW | `R3` 레이블 앵커 충돌(WARNING). 나머지 신규 식별자(`UNIDENTIFIED_IP_BUCKET`, `D-12`, `S-1`~`S-4`, `I-1`~`I-2`, `WH-SC-05`) 전부 충돌 없음 |

## 권장 조치사항

1. **(W-1 선처리 필수)** S-2 작업 착수 전 `spec/7-channel-web-chat/4-security.md` 의 기존 `### R3` 를 확인하고, 신규 내용을 기존 R3 에 병합(소항 추가)할지 `### R4` 로 분리할지 결정한다. 동일 앵커 중복은 링크 참조 오류를 유발하므로 사전 결정이 필요하다. → **채택: 신규 `### R6` 분리** (R1~R5 기존 존재, R3 의 infra-failure fail-open 과 IP-미식별 공유 버킷은 다른 차원이므로 분리; R3 에 R6 포인터 추가).
2. **(W-2 정리)** plan frontmatter 에서 `branch:` 필드를 제거한다. worktree 명이 동일 정보를 제공하므로 중복이다.
3. **(I-7 구체화)** plan Phase A 에 결정 1 의 WAF/Ingress 권고 기재 위치를 명시하는 체크리스트 항목(S-1b 또는 S-1 내 sub-item)을 추가한다. → 4-security §4 blockquote 에 기재.
4. **(I-2 / I-3 문구 처리)** S-1 초안 작성 시 per-IP / 공유 버킷 조건을 명확히 분리 서술하고, WH-SC-05 갱신 시 WH-SC-09 와의 규칙 경계를 한 줄 명시한다.
5. **(I-4~I-6 spec 작성 단계 반영)** S-2·S-4 작성 시 cross-ref 와 보강 범위를 위 INFO 항목에 따라 처리한다. plan 문서 자체 수정은 불필요하며 spec 작성 단계에서 반영하면 충분하다.
