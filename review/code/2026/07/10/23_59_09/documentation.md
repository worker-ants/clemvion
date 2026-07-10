# 문서화(Documentation) 리뷰 — commit `efc9e791e`

대상: 직전 리뷰(`review/code/2026/07/10/23_20_33/`)의 Warning 5건(W1~W5) 수정을 검증하는 fresh review. 이 문서는 문서화 관점에서 **fix 자체**를 검증한다 (기능 전체 재검토 아님).

## 검증 결과 요약

| # | 항목 | 결과 |
| --- | --- | --- |
| 1 | `responses.dto.ts` 4개 링크 off-by-one 수정 | **PASS** — 4/4 실존 파일로 resolve |
| 2 | 커밋 내 다른 파일에 동일 버그 잔존 여부 | **PASS** (커밋 범위 내). 단, 커밋 **밖**에 동일 버그 클래스의 기존 미수정 사례 1건 발견(아래 INFO) |
| 3 | `WaitingContextBaseDto` export 사유 JSDoc 정확성 | **PASS** — 실측(`tsc --noEmit`) 및 `@ApiExtraModels` grep 으로 두 주장 모두 확인 |
| 4 | `WaitingContextBase` 제거 후 stale 주석 | **PASS** — 소스 코드 내 잔존 참조 0건, 신규 주석도 실측 검증됨 |
| 5 | Korean JSDoc 커버리지 (swagger.md §1-1) | **PASS** — 변경 필드 전부 한국어 JSDoc 유지 |

## 발견사항

### [PASS] 항목 1 — `responses.dto.ts` 4개 상대링크 off-by-one 수정 확인

- 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:83, 102, 106, 191`
- 상세: 4곳 전부 `../../../../../` (5단계) → `../../../../../../` (6단계)로 수정됨. `dto/` 디렉토리에서 리포 루트까지 실제 경로 깊이(`dto/ → external-interaction/ → modules/ → src/ → backend/ → codebase/ → root`)는 6단계이므로 이제 정확하다. `os.path.normpath` + `realpath` + `test -f` 로 4개 링크 전부 직접 검증:
  - `spec/conventions/swagger.md` (83, 191행 — 동일 링크 2회) → EXISTS
  - `spec/conventions/conversation-thread.md` (102행) → EXISTS
  - `spec/5-system/2-api-convention.md` (106행) → EXISTS
- 결론: 커밋 메시지의 주장("루트까지는 6단계인데 5단계를 썼다")이 정확했고, fix 도 정확히 그 문제를 해소했다.

### [PASS] 항목 2 — 커밋 내 다른 파일은 동일 버그 없음, 단 커밋 밖에 잔존 사례 1건

- 위치: `responses.dto.spec.ts`, `interaction.service.ts`, `interaction.service.spec.ts`, `external-interaction.e2e-spec.ts`
- 상세:
  - `responses.dto.spec.ts` (동일 `dto/` 디렉토리)는 이번 커밋에서 **변경되지 않은** 3개 링크(26~28행)가 이미 `../`×6 으로 정확했다 — 이는 fix 커밋에서 "형제 파일과 대조해 버그를 발견했다"는 커밋 메시지 서술과 일치하며, 참조점으로서 여전히 유효하다.
  - `interaction.service.ts` / `interaction.service.spec.ts` / `external-interaction.e2e-spec.ts` 는 마크다운 스타일 상대링크(`[...](../...)`) 자체가 없다 — `§5.3`/`§5.4` 등은 모두 링크가 아닌 평문 각주라 off-by-one 위험이 애초에 없다.
- **[INFO] 커밋 범위 밖의 동일 버그 클래스 잔존 사례**
  - 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.types.ts:6`
  - 상세: `[Spec EIA §3.4 EIA-RL-06 / §9.3 R15](../../../../spec/5-system/14-external-interaction-api.md)` — 이 파일은 `external-interaction/` 바로 아래(즉 `dto/` 한 단계 얕음)에 위치해 루트까지 5단계(`../`×5)가 필요한데 4단계만 쓰여 있다. `realpath` 로 확인한 결과 `codebase/spec/5-system/14-external-interaction-api.md` 로 resolve되어 **깨진 링크**다. 이 파일은 `efc9e791e` 에서 건드리지 않았으므로 이번 fix 검증의 회귀는 아니지만, 커밋 메시지가 스스로 지적한 "spec-link-integrity 가드는 backend 소스를 스캔하지 않아 자동으로 잡히지 않는다"는 정확히 이 사례에도 해당한다.
  - 제안: 같은 W1 클래스의 잔존 버그이므로 별도 후속(가벼운 1줄 fix, 이번 PR 범위 밖)으로 등록 권장. 급하지 않음(INFO) — 다만 방치 시 계속 재발 가능한 패턴이므로, 가능하면 CI 에 backend 소스 `.ts` JSDoc 상대링크까지 스캔하도록 `spec-link-integrity` 가드 확장을 논의할 가치가 있다(가드 자체 확장은 이 리뷰 범위 밖의 별도 제안).

### [PASS] 항목 3 — `WaitingContextBaseDto` export 사유 JSDoc, 정확하고 실측 검증됨

- 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:85-89`
- 상세: 신규 JSDoc 문단이 주장하는 두 가지를 모두 코드로 실측했다.
  1. **"명시 annotate 필요, 안 하면 컴파일 에러"** — `const base: WaitingContextBaseDto = {...}` 의 타입 애너테이션을 실제로 제거하고 `npx tsc --noEmit` 을 돌려보니, `interaction.service.ts:313` 의 `context = {...}` 대입부에서 정확히 `TS2322: Type '... interactionType: string ...' is not assignable to type 'ButtonsContextDto | NodeOutputContextDto | null | undefined'` 에러가 발생함을 확인했다(`interactionType` 리터럴 유니언이 `string` 으로 widening). JSDoc 주장과 `interaction.service.ts:311` 의 신규 인라인 주석("지우면 아래 context 대입이 컴파일 에러로 드러난다") 둘 다 정확하다. (검증 후 원상복구, `git status` clean 확인.)
  2. **"@ApiExtraModels 미등록이라 phantom 스키마 없음"** — `grep` 으로 `@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto, CurrentNodeDto)` (152행)만 존재하고 `WaitingContextBaseDto` 는 인자에 없음을 확인. 실제로 OpenAPI `components.schemas` 에 등재되지 않는다는 주장과 일치한다(직전 리뷰 세션의 `architecture.md` 도 `SwaggerModule.createDocument()` 실행으로 동일하게 확인했다는 기록이 있어 교차 확인됨).
  3. **"구조적 타이핑이라 객체 리터럴 대입에 `new` 불필요"** — TypeScript 클래스가 타입 위치에 쓰일 때 구조적 타이핑을 따른다는 표준 동작과 일치. `const base: WaitingContextBaseDto = { ... }` (13번 항목 tsc 재현에서도 `new` 없이 정상 컴파일)로 실증됨.
- 결론: 이 JSDoc 은 "abstract 인데 왜 export 하는가"라는, 코드만 봐서는 의아할 수 있는 결정을 근거와 함께 정확히 설명하고 있다. 향후 리더가 이 클래스를 다시 non-export 로 되돌리려 시도할 때 정확히 막아줄 수 있는 수준의 문서다. 우수한 fix.

### [PASS] 항목 4 — `WaitingContextBase` 제거로 인한 stale 주석 없음

- 위치: 전체 리포지토리 `*.ts`/`*.md` grep
- 상세: `WaitingContextBase`(Dto 접미사 없는 옛 이름)는 **소스 코드**(`codebase/`) 어디에도 잔존하지 않는다 — `interaction.service.ts` 는 `type WaitingContextBaseDto` 로 정확히 갱신되어 있고 (`34행`), 사용부(`308행`)도 `WaitingContextBaseDto` 로 일치한다. `plan/`, `review/` 아래 남아있는 `WaitingContextBase` 언급은 전부 **당시 시점의 변경 이력을 서술하는 과거형 문서**(plan 체크리스트 완료 항목, 이전 리뷰 세션의 SUMMARY/architecture/scope/testing/side_effect.md, consistency-check 산출물)이며, 현재 코드를 잘못 설명하는 "stale 주석"이 아니라 정상적인 히스토리 기록이다.
- 신규 주석 `// (지우면 아래 context 대입이 컴파일 에러로 드러난다.)` (`interaction.service.ts:311`)도 위 항목 3에서 `tsc` 로 직접 실증했다 — 정확하다.
- 결론: 리네임/제거에 따른 문서 정합성 회귀 없음.

### [PASS] 항목 5 — Korean JSDoc 커버리지 유지 (swagger.md §1-1)

- 위치: `responses.dto.ts` 변경분 전체(`WaitingContextBaseDto` 클래스 및 3개 필드 `interactionType`/`waitingNodeId`/`conversationThread`)
- 상세: 클래스 레벨 JSDoc, 각 필드의 인라인 JSDoc, `@ApiProperty`/`@ApiPropertyOptional` 의 `description` 모두 한국어로 작성되어 있으며 swagger.md §1-1("모든 필드에 JSDoc 추가 (한국어)") 관례를 그대로 따른다. `WaitingContextBase` type alias 제거로 필드가 실제로 늘거나 준 것은 아니므로(단순 `Pick` 참조 제거) 커버리지 공백이 생기지 않았다.

## 기타 관찰 (체크리스트 6-8, non-issue)

- **README**: 변경 없음 — 내부 리팩터(타입 정리) + 문서 링크 수정 + 테스트 강화/추가로, 사용자 대면 기능·설정 변경이 없어 README 업데이트 불필요. 정확한 판단.
- **CHANGELOG**: `커밋 메시지·plan 문서 모두 "런타임 wire 무변경"을 명시적으로 확인`(interaction.service.spec.ts 신규 2건이 pre-change 코드로 스왑해도 PASS 한다는 이전 리뷰 기록과 일치). API 계약 변경이 없으므로 CHANGELOG.md 미갱신은 타당.
- **API 문서**: OpenAPI 스키마는 데코레이터 기반 자동 생성이며 이번 fix 로 스키마 자체는 변경되지 않음(`WaitingContextBaseDto` export 는 컴파일 타임 전용, `@ApiExtraModels` 미등록으로 스키마 미노출 — 항목 3에서 검증). 별도 API 문서 갱신 불필요.
- **예제 코드**: 신규 e2e `I-2`(`external-interaction.e2e-spec.ts`)가 `buttonConfig` variant 의 실제 wire 사용 예시 역할을 겸한다 — 별도 사용 예제 문서 불필요.
- **설정 문서**: 신규 환경변수/설정 옵션 없음.
- **RESOLUTION.md**: `review/code/2026/07/10/23_20_33/RESOLUTION.md` 가 W1~W5 각각의 조치와 근거(재검증 방법 포함, 예: "os.path.exists 로 4/4 EXISTS 재검증")를 표로 명확히 기록했고, 커밋 해시(`efc9e791e`)도 정확하다. 후속 2건(디렉토리 구조 이관, 위젯 타입 정밀화)도 fabricate 없이 별도 plan 문서로 정확히 이관되어 있다(`plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` §후속 확인).

## 요약

리뷰 대상 fix 5건(W1~W5) 중 문서화 관점에서 다룬 3건(W1 링크 off-by-one, W2 명명/JSDoc, 그리고 파생적으로 W3/W4 주석) 모두 실측 검증을 통과했다. 특히 항목 1의 4개 상대링크는 디스크상 실존 파일로 정확히 resolve됨을 `realpath`/`test -f` 로 직접 확인했고, 항목 3의 "abstract 인데 export하는 이유" JSDoc은 `tsc --noEmit` 실측과 `@ApiExtraModels` 등록 목록 확인으로 두 핵심 주장 모두 사실임이 검증됐다. `WaitingContextBase` 옛 이름은 소스 코드에서 완전히 제거되어 stale 참조가 없으며, 한국어 JSDoc 관례도 유지된다. 유일한 특기사항은 이번 커밋이 건드리지 않은 인접 파일(`terminal-revoke-reconciler.types.ts`)에 동일 버그 클래스의 미수정 사례가 하나 남아있다는 것으로, 이는 회귀가 아니라 커밋 범위 밖의 기존 결함이라 INFO로만 표기한다.

## 위험도

NONE

## 참고 파일 경로

- `/Volumes/project/private/clemvion/.claude/worktrees/eia-execution-context-schema-9bb60b/codebase/backend/src/modules/external-interaction/dto/responses.dto.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-execution-context-schema-9bb60b/codebase/backend/src/modules/external-interaction/dto/responses.dto.spec.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-execution-context-schema-9bb60b/codebase/backend/src/modules/external-interaction/interaction.service.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-execution-context-schema-9bb60b/codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-execution-context-schema-9bb60b/codebase/backend/test/external-interaction.e2e-spec.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-execution-context-schema-9bb60b/codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.types.ts` (INFO — 커밋 밖 잔존 off-by-one)
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-execution-context-schema-9bb60b/review/code/2026/07/10/23_20_33/RESOLUTION.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/eia-execution-context-schema-9bb60b/plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` (현재 `plan/complete/`로 이동됨 — HEAD 기준)
