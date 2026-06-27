# Code Review 통합 보고서 (fresh, --branch origin/main)

리뷰 대상: 그룹 A — 세션 토큰 sessionStorage 전환 + start() 에러 메시지 일반화 (commit 6e72bcc80·98106a405·67a5321ef)
일시: 2026-06-28 00:30:51
기준: `origin/main` (merge-base) — 1차(00_23_13)는 local main stale 로 diff 오염 → 본 run 으로 대체.

> **검증 결과: RISK=CRITICAL 으로 보고됐으나 Critical 1 + Warning 3 은 검증상 false positive 다(requirement-reviewer 오작동). 상세 refutation 은 RESOLUTION.md.**

## 전체 위험도
**LOW (검증 후)** — 보고는 CRITICAL 이나 Critical #1·Warning #1~3 은 디스크/테스트 사실과 모순되는 오탐. 실제 위험은 LOW(보안 강화 방향, 회귀 없음).

## Critical 발견사항 (reviewer 보고)
| # | 발견 | 검증 |
|---|------|------|
| 1 | `workspace-invitations-pruner` 가 MONITORED_QUEUES 에 미등록 → e2e broken | **FALSE** — constants.ts:75 에 등록됨, e2e PASS(218). reviewer 가 unchanged constants.ts 를 diff 에서 못 봄 |

## 경고 (WARNING, reviewer 보고)
| # | 발견 | 검증 |
|---|------|------|
| 1 | [SPEC-DRIFT] 2-sdk §3 여전히 localStorage | **FALSE** — 파일에 sessionStorage 반영됨(6e72bcc80) |
| 2 | [SPEC-DRIFT] 3-auth-session storage 미명시·§R6 미신설 | **FALSE** — §R6 신설+본문 sessionStorage 7회 반영됨 |
| 3 | [SPEC-DRIFT] 4-security 토큰노출 행 sessionStorage 없음 | **FALSE** — 행에 sessionStorage·탭종료 소거 반영됨 |
| 4 | errMessage 주석 `4-security §5`(프라이버시) 인용 부정확 | **MINOR(real)** — §5 는 데이터/정보 처리라 정보 노출 축소와 느슨히 연관(defensible). 정밀한 spec home 은 planner followup |

## 참고 (INFO) — 전부 비차단
- 보안(긍정): sessionStorage 전환·errMessage 일반화 = info-disclosure 위험 제거(#1·#2).
- 테스트 커버리지: getStorage SecurityError·saveSession QuotaExceeded·expiresAt 누락·sendCommand 에러 일반화 경로 미커버(#6~9) — 방어 경로, 비차단 followup.
- 유지보수: KEY_PREFIX 리터럴 중복(#10), 테스트 I8/I9 태그(pre-existing, #11), system-status 주석 PR맥락(#12), getStorage 파라미터명(#13) — 비차단.
- 문서: plan A-2 체크박스 갱신(#14, 본 후속 반영), W8 주석 문구(#15).
- 범위: system-status.e2e 1줄+주석이 channel-web-chat scope 밖이나 최소 drift 복구로 허용(#16).

## 에이전트별 위험도 요약
| 에이전트 | 보고 | 검증 |
|----------|------|------|
| requirement | CRITICAL | **오작동** — 큐 미등록·SPEC-DRIFT 전부 사실과 모순 |
| security | LOW | 보안 개선 확인. test origin 핀 권장(비차단) |
| scope | LOW | plan 부합. backend e2e 1건만 scope 외(최소 drift) |
| side_effect | LOW | localStorage orphan·탭공유 소멸은 §R6 의도. console.warn 진단 목적 |
| maintainability | LOW | 낮은 우선순위 cleanup |
| testing | NONE | 핵심 경로 커버 양호 |
| documentation | NONE | 주석/JSDoc 양호 |

## 권장 조치사항
1. **(refute)** Critical #1 + Warning #1~3 false positive — RESOLUTION.md 에 증거 기록. 코드/spec 정상.
2. **(followup, planner)** W4 — 4-security 에 에러 메시지 일반화 정책 명시 + 코드 주석 § 교정. §R6 localStorage 잔류 정책과 함께 spec polish followup.
3. **(followup)** 방어 경로 테스트(#6~9)·maintainability cleanup(#10~13) — 비차단 다음 이터레이션.
