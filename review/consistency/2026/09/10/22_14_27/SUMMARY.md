# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 2건 발견 (plan frontmatter 스키마 위반 1건, R-CC-21 좁히기 누락 1건)

## 전체 위험도
**CRITICAL** — 두 건 모두 target 문서 자체(plan draft) 안에서 발생한 결함이며 수정 범위가 각각 한 줄 수준으로 작아, 해소 후 재검토하면 즉시 BLOCK 해제 가능.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | plan frontmatter 필수 필드 `started` 누락 — 대신 `created: 2026-09-10` 를 씀. `checkPlanFrontmatter` 는 `^started:` 만 인식하고 `created:` 는 매치되지 않아 `started-invalid` 위반을 만든다 | 문서 최상단 frontmatter 블록 | `.claude/docs/plan-lifecycle.md` §4 + 시행 코드 `plan-frontmatter.test.ts`(`checkPlanFrontmatter`) | `created:` 를 `started:` 로 필드명만 교체(값 `2026-09-10` 유지). `plan/complete/` 이동 전 필수, 안 고치면 frontend 테스트 스위트 실패 |
| 2 | rationale_continuity | R-CC-21 `#### 우회의 형태` 절의 무한정 문장(`:750` "PATCH 는 어떤 비밀도 받지 않고, 어떤 비밀도 쓰지 않는다.")이 변경안 B 의 좁히기 대상 목록(`:761` 만 지정)에서 빠짐 — telegram 행 신설과 **같은 R-CC-21 항목 내부**에서 직접 모순 문장이 남는다. 원인은 3R 자체 재발-방지 grep 패턴("비밀을 쓰지 않는다")이 실제 문구("비밀도 쓰지 않는다")와 조사 한 글자 차이로 불일치해 매칭 실패 | "## 변경안" 표 항목 **B** (`15-chat-channel.md` `:734`·`:761`) | `15-chat-channel.md` R-CC-21 `#### 우회의 형태` 절 `:750` | 변경안 B에 `:750` 을 명시적 좁히기 대상으로 추가(예: "PATCH 는 botToken 값 교체와 slack/discord `inboundSigningPlaintext` 회전을 받지도 쓰지도 않는다 — telegram 서버 발급 축은 D-A 참조"). 재발 방지로 향후 전수 grep 패턴에 조사 변형(을/이/도/는) 포함 또는 어간 매칭 사용 |

## planner 인계 (권한 밖 Critical)

> 위 두 Critical 은 모두 **target 문서(plan draft) 자체 내부**의 결함이며, 이 draft 를 작성·수정하는 주체(project-planner, `spec/`·`plan/` 쓰기 권한 보유)가 직접 고칠 수 있는 범위다. `spec/` 정본 문서나 `codebase/` 로 이미 반영된 뒤 드러난 drift가 아니라 아직 적용 전 draft 단계의 자기 결함이므로, developer 권한 밖으로 넘길 사유가 없다.

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | "이 턴에 하지 않는 것" 절이 예고한 두 건의 트래커 등재(`details.field` 범위 확장, `swagger.md` Patch 접두 금지 명명 규약 신설 제안)가 변경안 표·체크리스트 어디에도 구체 `- [ ]` 항목으로 없음 — 바로 이 plan 계열의 직전 선행 plan(`spec-draft-chat-channel-patch-token.md`)이 2라운드에서 이미 겪은 "등재하겠다고 적고 실제로 등재 안 함" 실패와 동일 클래스 | `## 이 턴에 하지 않는 것` 2·3번째 불릿 | `spec-draft-nullable-notation-followups.md:2010-2019`(details.field 트래커), swagger.md 제안은 대상 트래커 자체 미지정 | 체크리스트에 두 항목을 `- [ ]` 로 명시 추가(대상 트래커 불명확한 swagger.md 건은 등재 위치부터 이 draft 안에서 확정) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | consistency 번들 예산이 이 draft 의 정본 대상 파일(`15-chat-channel.md`, `data-flow/14-chat-channel.md`) 자체와 관련 conventions(`secret-store.md`, `chat-channel-adapter.md`)를 통째로 떨어뜨림 — 직접 Read 로 우회 검증 완료, 판정에는 영향 없음 | harness 프롬프트 조립 단계 | `spec_impact` 명시 파일은 예산에서 최우선 보호하는 방식 검토 |
| 2 | cross_spec | telegram `issuedInboundSigning` 재발급이 `1-auth.md` §4.1 "특권 시크릿 교체" 전용 audit action 카탈로그 밖에 있음(draft 이전부터 있던 gap, D-A가 새로 만드는 것 아님) | D-A/D-B 결정 | §4.1 또는 CCH-SE-03 근처에 "telegram inbound-signing 재발급은 서버 자체 발급값이라 전용 audit action 대상 제외" caveat 한 줄 추가를 별도 트래커에 등재 권장 |
| 3 | cross_spec | D-C 서술("두 정본 표가 이미 가진 스코프를 좁히는 것")이 §5.4.1.1 자체엔 방향이 섞여 있음(섹션 스코프는 넓히고 회전 행 서술만 좁힘) | "## 결정" D-C | D-C 문장에 "(§5.4.1.1 섹션 스코프는 넓히고, 그 안 회전 행 서술은 좁힌다)" 괄호 보강 |
| 4 | plan_coherence | 변경안 E 가 `spec-draft-nullable-notation-followups.md:2031`(§5.4.1 표 2행 불확실성, open item)과 같은 자리를 겨냥하지만 교차 참조가 본문에 명시되지 않아 후속 독자가 "이미 처리됨"으로 오인할 소지 | 변경안 E | 변경안 E 설명에 nullable-followups:2031 교차 참조 문구 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | draft 의 5개 blanket-statement 자리·앵커 파급범위 전량 실측 일치, 6번째 자리 없음. INFO 3건(번들 예산·audit 카탈로그 caveat·D-C 서술 방향)만 |
| rationale_continuity | HIGH(개별 발견 CRITICAL 1건 포함) | D-A/D-B/D-C 결정 자체는 건실하고 기각된 대안 재도입 없음. 단 R-CC-21 `:750` 이 변경안 B 좁히기 대상 누락 → 같은 rationale 항목 내부 모순 잔존 |
| convention_compliance | CRITICAL | frontmatter `started` 필드 누락(`created` 오기)으로 `plan-frontmatter.test.ts` 실패 확정. 그 외 컨벤션 인용은 전부 정확 |
| plan_coherence | LOW | 선행 plan·spec 앵커 전량 정합, 경합하는 미해결 결정 없음. WARNING 1건(트래커 등재 예고 미실체화) |
| naming_collision | NONE | 신규 식별자 신설 없음, 기존 어휘 재사용만. 앵커 drift 영향범위(2곳) 정확 |

## 권장 조치사항
1. (BLOCK 해소) frontmatter `created: 2026-09-10` → `started: 2026-09-10` 필드명 교체
2. (BLOCK 해소) 변경안 B 표에 `15-chat-channel.md:750` 을 명시적 좁히기 대상으로 추가(문구 예시는 위 Critical #2 참조)
3. 재발 방지: 3R 대응에서 쓴 전수 grep 패턴에 조사 변형(을/이/도/는) 포함 또는 어간 매칭으로 전환
4. 체크리스트에 "이 턴에 하지 않는 것" 두 트래커 등재 항목을 `- [ ]` 로 명시 추가(대상 트래커 불명확한 swagger.md 건은 위치부터 확정)
5. (선택, 비차단) INFO 4건 — harness 번들 예산 보호, §4.1 audit 카탈로그 caveat 등재, D-C 서술 방향 보강, 변경안 E ↔ nullable-followups:2031 교차 참조 명시
