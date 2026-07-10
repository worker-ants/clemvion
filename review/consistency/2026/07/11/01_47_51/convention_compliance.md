# 정식 규약 준수 검토 — spec-draft-waiting-surface-guard

target: `plan/in-progress/spec-draft-waiting-surface-guard.md`
검토 모드: spec draft 검토 (--spec)
점검 축: ① 명명 규약 ② 출력 포맷 규약 ③ 문서 구조 규약(Overview/본문/Rationale) ④ API 문서 규약 ⑤ 금지 항목
지시된 중점: spec 문서 3섹션 구조 · `error-codes.md`(신규 코드 없음) · spec-link-integrity(신규 앵커 링크 실존) · `spec-impl-evidence.md`(registry frontmatter `code:` 에 `waiting-surface-guard.ts` 추가)

---

## 발견사항

- **[CRITICAL]** draft 컨테이너(plan) frontmatter 에 `worktree:` 필수 필드 누락
  - target 위치: `plan/in-progress/spec-draft-waiting-surface-guard.md` frontmatter (L1-6)
  - 위반 규약: [`spec/conventions/spec-impl-evidence.md` §4.2](../../../../../spec/conventions/spec-impl-evidence.md) 의 지식저장소·plan 무결성 family — `plan-frontmatter.test.ts` (build 차단). 규약 SoT 는 [`plan-lifecycle.md §4`](../../../../../.claude/docs/plan-lifecycle.md#4-frontmatter-스키마): "세 필드(`worktree`·`started`·`owner`)는 top-level `plan/in-progress/*.md` 에서 **필수**".
  - 상세: target frontmatter 는 `name:`/`description:`/`owner:`/`started:` 만 있고 `worktree:` 가 아예 없다. `plan-frontmatter.test.ts` 소스를 직접 확인한 결과 `typeof data.worktree === "string" && length > 0` 를 요구하며, 이 파일은 top-level(`0-`/`_` prefix 아님)이라 면제 대상도 아니다 — 현재 상태로 커밋되면 이 단위 테스트가 **hard fail** 한다. 실측 확인: `plan/in-progress/*.md` 전체를 스캔한 결과 `worktree:` 가 없는 파일은 이 draft **하나뿐**이다(다른 spec-draft 자매 파일 — `spec-draft-pr874-deferred-docs.md`, `spec-draft-error-codes.md`, `spec-draft-crash-running-redrive.md` 등은 모두 `worktree: <task>-<slug>` 를 보유).
  - 제안: frontmatter 에 `worktree: <현재 worktree 디렉토리명>` (현재 세션 기준 `elegant-driscoll-eebdd6` 계열 실제 이름, 또는 아직 확정 전이면 sentinel `(unstarted)`) 을 추가한다. 자매 draft 들의 관례를 따라 `name:`/`description:` 대신 `title:` 필드명 사용도 함께 정리 권장(아래 INFO 항목 참조, 이건 build 차단은 아님).

- **[WARNING]** §5(`interaction-type-registry.md`) `code:` 추가 지시가 repo-root 상대경로가 아닌 bare filename
  - target 위치: draft 본문 "## 변경 5 — `spec/conventions/interaction-type-registry.md` §1.1" 마지막 괄호 — "(`code:` frontmatter 에 `waiting-surface-guard.ts` 추가.)"
  - 위반 규약: [`spec-impl-evidence.md` §2.1](../../../../../spec/conventions/spec-impl-evidence.md#21-필드-정의) — `code:` 필드는 "레포 루트 기준 상대경로". `interaction-type-registry.md` 기존 9개 `code:` entry 전부 `codebase/backend/...` / `codebase/frontend/...` 형태의 전체 경로다.
  - 상세: 실제 파일은 `codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts` 에 위치(코드베이스에서 실존 확인). 그러나 draft 문구를 문자 그대로 옮겨 frontmatter 에 `- waiting-surface-guard.ts` 라는 **bare filename** 만 추가하면, `spec-code-paths.test.ts` 가 쓰는 `globMatchesAny()` 는 와일드카드가 없는 리터럴 패턴을 `fs.existsSync(path.join(root, pattern))` 로 그대로 검사한다 — 즉 `<repo-root>/waiting-surface-guard.ts` 존재 여부를 보는데, 그 경로엔 파일이 없다. 이 경우 인접 9개 entry 중 하나가 이미 매치하므로 **`status: implemented` 의 code: ≥1 매치 가드 자체는 통과**하지만(하드 fail 아님), 이번 변경이 의도한 "waiting-surface-guard.ts 를 registry 의 실제 evidence 로 등재" 목적은 조용히 무효화된다 — §R-1 이 우려하는 "코드 부재를 가리는 stale glob" 과 반대 방향의, 애초에 매치하지 않는 죽은 literal 이 남는 문제다.
  - 제안: 실제 spec 반영 시 `code:` 리스트에 전체 경로 `codebase/backend/src/modules/execution-engine/waiting-surface-guard.ts` 를 명시하도록 draft 문구를 구체화(또는 반영 담당자에게 이 경로를 명확히 전달).

- **[INFO]** 변경 1b 의 인용 텍스트가 지정된 라인(L1041)과 문자 그대로 일치하지 않음
  - target 위치: draft 본문 "### 1b. L1041 receiver 서술 보강"
  - 위반 규약: 없음(이 항목은 spec-link-integrity/error-codes/spec-impl-evidence/3섹션 구조 4개 축 자체의 위반은 아니며, 반영 시 오타겟 위험에 대한 참고 메모)
  - 상세: `spec/5-system/4-execution-engine.md` 의 실제 L1041 은 "§7.4 의 입력 receiver (controller / WS gateway) 가 publish 직전에 `nodeId → nodeExecutionId` DB lookup 을 수행하는 단계 …" 이며, draft 가 find-target 으로 인용한 "0건 또는 다중 row … nodeId 미일치" 라는 연속 문자열은 그 위치에 없다. 해당 어구는 L896(§7.4 표, "0건 또는 다중 row 이면 즉시 client 에 에러") 와 L1045(§7.5.1 표 셀, "…nodeId 미일치") 두 곳에 조각으로 나뉘어 있다.
  - 제안: 반영 단계에서 "L1041" 을 문자 그대로 find-replace 좌표로 쓰지 말고, 실제 삽입 지점(예: L1054 `resolveWaitingNodeExecutionId` 서술 또는 L1045 표 셀 원인 열)을 재확인해 문구를 삽입하도록 안내를 보강.

- **[INFO]** plan frontmatter 필드명이 자매 `spec-draft-*.md` 관례(`title:`)와 다름
  - target 위치: `plan/in-progress/spec-draft-waiting-surface-guard.md` frontmatter L2-3 (`name:`/`description:`)
  - 위반 규약: build-차단 규약은 아님(`plan-frontmatter.test.ts` 는 `title` 필드를 요구하지 않고 "추가 필드 허용"으로 명시) — 단 `.claude/docs/plan-lifecycle.md §4` 예시 스키마 및 기존 `plan/{in-progress,complete}/spec-draft-*.md` 전수가 `title:` (또는 무-title, H1 만) 을 쓰는 관례와 다름.
  - 상세: 순수 스타일 일관성 문제. 기능적 영향 없음.
  - 제안: 선택적으로 `title:` 로 정리(강제 아님).

---

## 요약

핵심 4대 점검축 중 **error-codes 규약**(신규 코드 미도입 — `InvalidExecutionStateError`/`INVALID_EXECUTION_STATE`/`STATE_MISMATCH`/`INVALID_STATE` 재사용이 실제 구현·기존 관례와 일치함을 코드 대조로 확인), **spec-link-integrity**(draft 가 인용하는 모든 상대경로·앵커 — `§7.5.1`, Presentation `§10.9`, EIA-IN-13, 각 파일 기준 상대 depth — 를 대상 파일에서 직접 grep/Read 로 대조한 결과 전부 기존에 이미 통용되는 유효 앵커/경로였다), **문서 3섹션 구조**(draft 자체는 `project-planner` SKILL.md 가 요구하는 "`spec-draft-<name>.md` + 본문 끝 `## Rationale`" 형식을 준수하고, 반영 대상 5개 spec 파일의 편집도 기존 Overview/본문/Rationale 경계를 흐트러뜨리지 않는다)는 모두 준수 상태다. 다만 **spec-impl-evidence 축**에서 draft 컨테이너 자체의 plan frontmatter 에 build-차단 필수 필드 `worktree:` 가 누락되어 있어(자매 draft 전수 중 유일하게 결여) 이 상태로 커밋되면 `plan-frontmatter.test.ts` 가 즉시 fail한다 — spec 변경 여부와 무관하게 draft 파일 존재 자체가 게이트를 깨는 CRITICAL 이슈다. 아울러 §5 의 `code:` 추가 지시가 repo-root 상대경로 규칙을 충족하지 못하는 bare filename 이라 반영 시 실제 evidence 매칭에 실패할 위험이 있다(WARNING). 두 건 모두 spec 본문 내용 자체의 문제가 아니라 draft 의 메타/서술 정밀도 문제로, 반영 전 간단한 수정으로 해소 가능하다.

## 위험도

MEDIUM — CRITICAL 1건이 있으나 그 대상이 spec 본문의 실질 계약이 아니라 draft plan 파일의 frontmatter 메타데이터 누락이라 반영 전 1줄 수정으로 해소 가능하고, spec 본문에 실제 반영될 4대 핵심 축(3섹션 구조·error-codes·spec-link-integrity·spec-impl-evidence 의 code: 매칭 로직)은 실질적으로 준수 상태다.
