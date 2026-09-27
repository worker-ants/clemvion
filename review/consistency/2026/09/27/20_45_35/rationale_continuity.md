# Rationale 연속성 검토 — spec-draft-cross-workspace-refs-2

## 발견사항

- **[WARNING] `spec/1-data-model.md` 를 lifecycle-tracking 대상으로 편입하면서 그 문서를 그 tracking 에서 뺀 기존 결정(EXCLUDE_BASENAMES)과 그 문서 자신의 `code:` 관례(전용 e2e 가드 나열)를 둘 다 무시 + 가드 강제를 사실과 다르게 서술**
  - target 위치: `plan/in-progress/spec-draft-cross-workspace-refs-2.md` `## 변경안` 3번 + `## Rationale` 두 번째 불릿("구현 plan 이 `complete/` 로 옮겨지는 커밋에서 `implemented` 로 되돌린다 — `spec/conventions/spec-impl-evidence.md` §3 이 «마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격» 을 가드로 강제한다")
  - 과거 결정 출처:
    1. `spec/conventions/spec-impl-evidence.md` §1 "제외" — "basename `1-data-model.md` · `6-brand.md` (단순 overview 성격) — `EXCLUDE_BASENAMES` 에 등재." (`## Rationale` 절 바로 위, §1 적용 대상 결정)
    2. `spec/1-data-model.md` 자체의 `## Rationale` "`code:` 에 전용 e2e 가드 셋 (2026-09-19)" — 이 문서의 `code:` frontmatter 는 일반 spec 처럼 "약속한 surface 의 구현 경로 glob" 이 아니라 **이 문서의 사실을 지키는 전용 e2e 파일 나열**이라는, `spec-code-paths.test.ts` 의 일반 의미론과 다른 bespoke 용법으로 이미 확정돼 있다.
  - 상세: `spec/conventions/spec-impl-evidence.md` §2.1/§3/§4 가 정의하는 `status`/`pending_plans` lifecycle(=partial→implemented 승격을 build 가드가 강제)은 `spec-frontmatter-parse.ts` 의 `EXCLUDE_BASENAMES`(`1-data-model.md` 포함)가 걸러낸 파일에는 **애초에 적용되지 않는다** — `collectApplicableSpecs()`(→`isApplicable()`)를 공유하는 `spec-frontmatter.test.ts`/`spec-code-paths.test.ts`/`spec-status-lifecycle.test.ts`/`spec-pending-plan-existence.test.ts` 4개 가드 전부가 이 basename 을 건너뛴다(실측: `spec-frontmatter-parse.ts:57-80`, 각 가드 파일의 `collectApplicableSpecs` import). 즉 target 의 변경안 3번(“status: implemented → partial, `pending_plans:` 추가”)이 실제로 적용돼도 (a) `pending_plans` 경로 실존 여부, (b) `partial` 의 TTL/승격 시점, (c) `pending_plans` 가 전부 `complete/` 로 이동했는데 `implemented` 로 안 올렸는지 — 이 셋 중 **어느 것도 build 가드가 검사하지 않는다**. `1-workflow-list.md`/`0-canvas.md`(둘 다 basename 제외 목록 밖)에 대해서는 같은 문장이 참이지만, `1-data-model.md` 에 대해서는 target 의 Rationale 이 서술하는 "가드로 강제한다" 가 **거짓**이다. 이 gap 은 정확히 `spec-impl-evidence.md` R-5 가 막으려던 실패 모드("spec 가 plan 을 가리키지만 아무도 추적을 강제하지 않아 영구 누락")를, `1-data-model.md` 한 곳에서 **가드가 원천적으로 못 보는 방식**으로 재생산한다 — target 은 이 basename 제외를 인지·언급하지 않았고, 제외를 풀거나 예외로 남겨 두는 것에 대한 새 Rationale 도 없다.
  - 제안: 아래 중 하나를 택해 draft 를 수정한다.
    1. `1-data-model.md` 항목을 순수 정보성 라벨링으로 낮추고, Rationale 문장에서 "가드로 강제한다"(build-gate enforcement) 주장을 삭제하거나 "이 문서는 `spec-impl-evidence.md` §1 에 의해 frontmatter-evidence 가드 대상에서 제외돼 있어 이 `status`/`pending_plans` 는 가드가 검증하지 않는 수동 라벨이다" 로 정정한다.
    2. 정말 gate-enforced tracking 이 필요하다면 `spec/conventions/spec-impl-evidence.md` §1 의 `EXCLUDE_BASENAMES`(및 `spec-frontmatter-parse.ts` 구현)에서 `1-data-model.md` 를 빼는 **별도의, 명시적인 convention 변경**을 하고 그 결정의 근거(왜 "단순 overview 성격" 이 더는 성립하지 않는가)를 `spec-impl-evidence.md` `## Rationale` 에 새로 적는다 — 이 draft 범위에 조용히 끼워 넣지 않는다.

- **[INFO] `1-data-model.md` 의 `status: partial` 표기가 그 문서 자신의 "단순 overview" 성격 규정과 결이 어긋난다**
  - target 위치: `plan/in-progress/spec-draft-cross-workspace-refs-2.md` `## 변경안` 3번
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md` §1 "basename `1-data-model.md` … (단순 overview 성격)"
  - 상세: §1.1(참조의 소속) 은 데이터 모델 문서 전체가 아니라 그 문서 안의 한 좁은 규칙 절이다. 문서 전체의 `status` 를 `partial` 로 내리는 것은 "이 문서가 약속한 모든 것 중 일부만 구현됨" 을 의미하는데, 실제로는 문서 대부분(엔티티 정의 82개 절)이 이미 구현·검증된 스키마 서술이고 어긋나는 것은 §1.1 신설 규칙 하나뿐이다. 위 WARNING 과 같은 근본 원인(이 문서는애초에 그런 부분-완성 단위로 추적되는 문서가 아니라는 것이 §1 제외의 근거)이라 별도 항목으로 올린다.
  - 제안: 위 WARNING 의 처방과 동일 — 정보성 라벨이라면 "일부 절의 구현 지연" 이라고 범위를 좁혀 쓰거나, 문서 전체 status 대신 §1.1 절에 인라인 각주로 미구현 상태를 적는 방안도 검토할 것.

## 요약

target 의 핵심 처방(`1-workflow-list.md`/`0-canvas.md` frontmatter `pending_plans:` 추가 + Rationale 시제·경로 정정)은 직전 두 차례 `--impl-prep`/`--spec` BLOCK 이 지적한 결함을 정확히 겨냥하고, 그 두 문서는 `spec-impl-evidence.md` 의 frontmatter-evidence 가드 대상이라 이 처방이 실제로 gate 에 반영된다 — 이 부분은 기존 Rationale(R-5, §2.1/§3/§4)과 정합적이다. 다만 target 이 스코프를 넓혀 셋째 대상으로 추가한 `spec/1-data-model.md` 는 `spec-impl-evidence.md` §1 이 `EXCLUDE_BASENAMES` 로 이미 frontmatter-evidence 가드 대상에서 제외한 문서이고(코드로도 확인됨), 그 문서 자신의 `code:` 필드도 일반 spec 과 다른 bespoke 의미(전용 e2e 가드 나열)로 이미 확정돼 있다. target 은 이 두 기존 결정을 언급도 재검토도 하지 않은 채 같은 3개 대상에 같은 lifecycle 메커니즘(status/pending_plans)을 적용하고, 그 메커니즘이 "가드로 강제된다"고 서술한다 — `1-data-model.md` 에 한해 이 서술은 실측(가드 소스)과 어긋난다. 기능적 파손(빌드 실패·데이터 손상)은 없고 gate 는 기존과 같이 이 파일을 계속 건너뛸 뿐이지만, "가드가 지켜준다" 는 잘못된 안전감을 문서에 영구히 남기는 결과라 WARNING 으로 판단한다. 그 밖의 항목(라벨 생략 결정, plan 경로 표기, 트래커 후속 위임 등)은 자체 Rationale 을 갖추고 있고 기존 결정과 충돌하지 않는다.

## 위험도
MEDIUM
