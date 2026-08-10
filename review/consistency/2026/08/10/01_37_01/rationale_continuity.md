# Rationale 연속성 검토 (재검토) — plan-lifecycle-gates

## 프롬프트 결함 확인 (선행 사실)

이번에도 알려진 결함대로 diff 섹션과 실제 target 문서가 번들에서 누락돼 있었다(`_prompts/rationale_continuity.md` 2755줄 안에 `TERMINAL_PLAN_STATUSES`·`docs-guard-walker-dedup` 문자열이 0건). 워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)에서 `git log`/`git show`/`Read`로 직접 재구성해 검토했다.

## 대상 재구성 (직접 확인)

최신 커밋 `88555a52b`("fix(harness): consistency checker 5종 지적 9건 반영")의 diff에서 호출자가 지목한 두 신규 결정을 확인:

1. **`TERMINAL_STATUSES` → `TERMINAL_PLAN_STATUSES` 개명** — `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`(export 선언부)·`plan-scan.test.ts`·`plan-frontmatter.test.ts`(에러 메시지)·`.claude/docs/plan-lifecycle.md`(§4 서술)·`spec/conventions/spec-impl-evidence.md`(§2.2 신설 문단) 5곳 동기 반영. `Set` 값 자체(`complete`/`implemented`/`applied`/`superseded`)는 무변경 — 식별자명만 변경.
2. **`docs-guard-walker-dedup.md` 신설** — `plan/in-progress/harness-env-value-subpattern-dedup.md`에 잘못 이관돼 있던 "문서 가드 walker 3벌 통합" + "`SpecMdFile` 타입명" 두 항목을 되돌리고 신규 plan으로 분리. 원 plan에는 분리 사유(코드베이스·언어·실패 모드 상이)와 포인터를 남김.

추가로 `spec/conventions/spec-impl-evidence.md §2.2`에 plan frontmatter `status`(2026-08-10 신설, `plan-scan.ts`의 `TERMINAL_PLAN_STATUSES`가 SoT)와 spec frontmatter `status`(§3)가 `implemented` 값을 공유하지만 별개 도메인이라는 문단이 추가됐다.

## 점검 관점별 확인

### 1) 기각된 대안의 재도입

두 결정 모두 spec `## Rationale` 전수(특히 `spec/conventions/spec-impl-evidence.md` R-1~R-10)에서 명시적으로 기각된 적이 있는 대안을 다시 쓰는 사례를 찾지 못했다.

- **개명**: backend `execution-engine.service.ts`(499행)·`interaction.service.ts`(44행)에 동명 `TERMINAL_STATUSES`(모듈-scope/private static, import 없음)가 실존함을 확인했다 — 커밋 메시지의 "동명 상수" 주장은 사실이다. `plan/complete/spec-sync-5-system-metrics-gap.md:37`은 오히려 그 backend 상수 자체를 향후 `TERMINAL_EXECUTION_STATUSES`로 재개명하자는 별개 항목을 이미 갖고 있어, grep 기반 감사의 혼동 위험이 가상의 우려가 아님을 뒷받침한다. 이 개명을 반대하거나 원래 이름을 고수하라는 과거 Rationale은 없다(9e880e908에도 이름 자체에 대한 근거 서술 없음, 단지 값 어휘 보존만 논의됨) — "종료 어휘 보존" 결정(직전 라운드가 확인)은 **status 값 4종의 존속**에 대한 것이지 TS 식별자명에 대한 것이 아니므로 이번 개명과 충돌하지 않는다.
- **plan 분리**: 동일 PR 안에서 "잘못 이관했다"는 자기 정정으로, 별도 확립된 결정을 뒤집는 것이 아니다. `plan-lifecycle.md`·`CLAUDE.md`에 "관련 follow-up은 반드시 기존 plan에 편입해야 한다"는 원칙이 없으며, 오히려 §2 "research 문서가 낳은 실행 항목은 별 plan으로 분기"라는 기존 패턴과 결이 같다.

### 2) 합의된 원칙 위반

발견 없음. 두 결정 모두 기존 원칙(도메인 분리 시 이름/파일 분리, R-6의 "같은 이름·다른 invariant는 통합 안 함" 패턴)과 정합적이다.

### 3) 결정의 무근거 번복

발견 없음 — 둘 다 새 근거를 함께 남겼다: 개명은 커밋 메시지 + `plan-scan.ts` 자체 export 부, plan 분리는 `docs-guard-walker-dedup.md ## Rationale`("왜 별 plan인가")와 `harness-env-value-subpattern-dedup.md`의 되돌림 절 양쪽에 상세 서술.

### 4) 암묵적 가정 충돌

`spec-impl-evidence.md §2.2` 신규 문단을 R-6("`code:` 의미 도메인 — 같은 이름, 다른 invariant, 통합 안 함")과 R-9(§4.2를 별도 family로 분리한 근거)에 대조했다. 신규 문단은 정확히 같은 패턴을 `status:` 키에 확장 적용한 것 — "plan `status`(2026-08-10, `plan-scan.ts` SoT)와 spec `status`(§3)는 `implemented` 값을 공유하지만 문서 타입·가드가 완전히 갈리고 어휘를 맞출 의무가 없다"는 서술이 R-6/R-9가 이미 세운 도메인 분리 invariant를 그대로 재확인할 뿐 우회하지 않는다.

## 참고 관찰 (경미, 위반 아님)

- `harness-env-value-subpattern-dedup.md`의 "그 기준은 이 저장소가 `#970`(blind 정규식 vs 정밀 파서)에서 이미 세웠다"는 인용을 `git show cdad5a1ec`(2026-07-17 정밀 파서 재작성)·`git show a07ae56ae`(#992, 2026-07-23 blind 1차+열거 allowlist로 되돌림)로 실측 대조했다. 사건 자체는 실재하고 "정밀 통합이 무한 표면을 만든다"는 결이 이번 walker 통합 유보 판단과 통하지만, `#970`이 확립한 원 원칙은 "막는 쪽은 무지하게, 푸는 쪽만 정밀하게"(security 게이트 설계)이지 "일반 코드 중복을 문서 조직상 어떻게 나눌지"의 판단 기준이 아니다 — 실제 결정 근거는 정확했다(주제 유사성만 있고 코드베이스·언어·실패모드 상이)이므로 이 인용은 결정을 뒷받침하는 부가 근거일 뿐, 결정 자체가 이 인용에 의존하지 않는다. Rationale 연속성 위반은 아니나, 인용 범위를 좁혀 쓰면(예: "판단 기준이 유사하다" 정도로) 더 정확하다.

## 요약

이번 라운드에서 새로 생긴 두 결정(`TERMINAL_STATUSES` → `TERMINAL_PLAN_STATUSES` 개명, `docs-guard-walker-dedup.md` 신규 분리) 모두 기존 spec `## Rationale`(특히 `spec-impl-evidence.md` R-6·R-9)이 세운 "같은 이름·다른 invariant는 통합하지 않고 도메인별로 분리한다"는 원칙을 위반하지 않고, 오히려 그 원칙을 `status:` 키·TS 식별자·plan 문서 조직에 일관되게 확장 적용한 결과로 보인다. 개명은 backend 동명 상수 실존을 직접 확인해 근거가 사실에 부합했고, plan 분리는 같은 PR 안의 자기 정정으로 별도 새 Rationale(`docs-guard-walker-dedup.md ## Rationale`)을 함께 남겼다. `spec-impl-evidence.md §2.2` 추가 문단도 R-9의 family 분류와 정합적이다. 유일한 경미 관찰은 `#970` 인용이 원 사건의 도메인(보안 게이트 설계)보다 넓게 일반화됐다는 점인데, 결정 자체는 그 인용 없이도 성립하는 독립 근거를 갖고 있어 CRITICAL/WARNING으로 격상할 사안은 아니다.

## 위험도

NONE

STATUS=success
