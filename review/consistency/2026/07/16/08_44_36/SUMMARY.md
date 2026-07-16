# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 모두 완료(workflow journal 확인), Critical 0.

## 스코프 주의 (중요)

이번 검토는 `--impl-prep spec/conventions/` 로 실행됐다. 그러나 실제 착수 작업(plan §3
node-linker=hoisted→isolated 전역 전환)은 **build-infra/의존성 변경으로 `spec/` 을 전혀 건드리지
않는다** (변경 set: `.npmrc`·`pnpm-workspace.yaml`·`pnpm-lock.yaml`·backend `package.json`·
backend/frontend `Dockerfile`·`next.config.ts`·`docker-compose.e2e.yml`·plan 문서). 따라서 5개
checker 는 diff 가 아니라 **scope 로 지정된 `spec/conventions/` 폴더의 기존 콘텐츠**(주로
cafe24-api-catalog·audit-actions)를 감사했다. 발견된 항목은 전부 그 폴더의 **선재(pre-existing)
문서 드리프트**이며 본 변경과 무관하다.

node-linker 변경에 대한 유일하게 관련 있는 관점 — **rationale 연속성(hoisted 유지 결정의 번복)** —
은 본 plan `§3` 이 애초에 "green 안정 후 strict isolation 으로 좁혀 검토" 로 **명시 계획한 진행**이라
기각된 대안의 무근거 재도입이 아니다. (rationale_continuity checker 는 위험도 NONE 반환.)

## Critical 위배 (BLOCK 사유)
없음.

## 경고 (WARNING) — 모두 본 변경과 무관한 선재 사항
| # | Checker | 항목 (scope=spec/conventions/) | 위험도 |
|---|---------|------|------|
| 1 | cross_spec | cafe24 "Webhooks setting" 오퍼레이션명 ↔ 플랫폼 "Webhook 트리거" 라벨 혼동 가능(구조 충돌 아님) | LOW |
| 2 | convention_compliance | `cafe24-api-catalog/_overview.md` §7.1 kebab-case 규칙이 실제 `__` 중첩 파일명 관행 미반영 / §4 규칙8 코드주석 번호 오귀속 | LOW |
| 3 | plan_coherence | `_overview.md` §7 각주가 G-1-remaining 완료 시점 미반영(stale) | NONE/INFO |
| 4 | naming_collision | audit-action `.` vs cafe24 id `_` separator 병존(도메인 다름, 충돌 없음) | LOW |

## 참고 (INFO)
- rationale_continuity: 리뷰 payload 발췌 조립이 크기 한도로 target 인용 SoT Rationale 일부 누락 →
  checker 가 repo 직접 대조로 보완, 위반 없음 확인(orchestrator payload 로직 개선 제안, target 결함 아님).

## Checker별 결과 (workflow journal 기준 — 5/5 완료)
| Checker | 위험도 | 비고 |
|---------|--------|-----|
| cross_spec | LOW | 위 WARNING #1 (선재, 무관) |
| rationale_continuity | NONE | 기각 대안 재도입·무근거 번복 없음. 유일 이슈는 payload 로직(target 결함 아님) |
| convention_compliance | NONE | 위 WARNING #2 (선재, 무관) |
| plan_coherence | LOW | 위 #3 (선재, 무관) |
| naming_collision | LOW | 위 #4 (선재, 무관) |

> **FS-write flakiness 주의**: 5개 checker 중 `rationale_continuity.md` 만 디스크에 persist 됐고
> 나머지 4개는 `status=success` 인데 output_file 미생성(프로젝트 기지 비결정 현상,
> MEMORY: "Consistency/ai-review Workflow FS-write flakiness"). 4개의 실제 반환 결과는 workflow
> journal(`journal.jsonl`)에 전문 보존되어 있어 위 표는 그 내용으로 작성했다 — checker 미실행이
> 아니라 디스크 write 만 누락된 것이라 재실행 없이 결과 확정. 어느 checker 도 Critical 없음.

## 판정
**BLOCK: NO.** node-linker 전역 전환의 실질 검증은 TEST WORKFLOW(both-stack e2e 포함, 전부 green)와
후속 `/ai-review` 가 담당한다. 본 consistency-check 는 scope 특성상 diff 직접 신호는 제한적이나,
관련 rationale 관점에서 차단 사유 없음.
