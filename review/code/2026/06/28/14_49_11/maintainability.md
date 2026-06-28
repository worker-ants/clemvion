# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `EmbedConfigDto` — JSDoc 과 `@ApiProperty.description` 내용 중복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` L59–75
- 상세: `allowlist` 와 `enforce` 필드에 추가된 JSDoc(`/** ... */`)이 바로 아래 `@ApiProperty({ description: ... })` 와 거의 동일한 문장을 담고 있다. 두 곳 중 하나가 수정될 때 나머지가 누락되어 drift 가 발생할 가능성이 있다. 같은 파일의 다른 DTO들(`webhook-response.dto.ts` 등)이 JSDoc 없이 `@ApiProperty`만 쓰는 경향이 있다면 일관성 차원에서도 검토 여지가 있다.
- 제안: JSDoc 을 제거하고 `@ApiProperty.description` 을 단일 진실로 유지하거나, 반대로 JSDoc 을 SoT 로 두고 `@ApiProperty.description` 을 참조 형태(`{@inheritDoc}` 또는 단순 위임)로 줄이는 방향 중 하나를 일관성 있게 선택한다. 현재 변경 자체는 비차단이며 프로젝트 컨벤션에 따라 처리한다.

---

### [INFO] `safeApiBaseFromQuery` — 변수명 `u` 가 의도를 즉시 전달하지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.ts` L305
- 상세: `const u = new URL(raw)` 에서 `u` 는 관용적 약어지만, 이 함수가 exported 공개 API 이며 단독으로 테스트되는 함수임을 감안하면 `parsedUrl` 또는 `url` 처럼 명확한 이름이 읽기를 돕는다. 함수 본체가 짧아 실질 피해는 미미하다.
- 제안: `const url = new URL(raw)` 로 변경하고 `u.protocol` 참조를 `url.protocol` 로 수정한다.

---

### [INFO] `use-widget.ts` 전체 — God hook 구조가 이번 변경 후에도 유지됨(pre-existing)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.ts` L324 이하 `useWidget` 함수 전체
- 상세: 이번 변경(`safeApiBaseFromQuery` 추출·export)은 god hook 의 부분 분리 방향으로 올바른 움직임이다. `useWidget` 자체는 약 350+ 라인, 10개 이상의 `useCallback`, 중첩 async 함수(`applyConfig`), 6개 ref 를 유지하고 있어 순환 복잡도가 여전히 높다. 그러나 이는 본 PR 이전부터 존재하는 pre-existing 구조이며 본 변경이 악화시키지 않는다.
- 제안: 이번 변경의 범위 밖이므로 조치 불필요. 별도 리팩터링 계획(`refactor` 백로그 M-3 이하)에서 처리하는 것이 적절하다.

---

### [INFO] 테스트 파일 — 테스트 설명 일관성 패턴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.test.ts` L109–127
- 상세: 추가된 5개 테스트 케이스는 `it("https URL → 그대로 허용")` 처럼 한국어 화살표 서술을 쓰고 있어 기존 파일의 `it("refreshDelayMs·TOKEN_REFRESH_MIN_DELAY_MS 가 use-widget 에서 re-export 됨")` 패턴과 동일 언어를 유지한다. 일관성 면에서 문제없다. `afterEach(() => vi.restoreAllMocks())` 블록도 spy 정리를 명시적으로 표현해 가독성이 좋다.
- 제안: 현 상태 유지. 특이 사항 없음.

---

### [INFO] `plan/in-progress/webchat-polish-batch.md` — 완료 항목과 미완료 절차의 혼재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/plan/in-progress/webchat-polish-batch.md`
- 상세: `## 변경` 섹션의 항목들은 `[x]`(완료) 로 표기됐으나 `## 절차` 섹션은 전부 `[ ]`(미완료) 상태다. plan 파일 자체의 가독성·추적 의도는 명확하다. 다만 `[~]` 상태(revert 보류)에 대한 의미가 프로젝트 컨벤션에 명시적으로 정의돼 있는지 확인이 필요할 수 있다.
- 제안: 현 상태 유지. `[~]` 표기가 컨벤션 미정의라면 plan-lifecycle.md 또는 주석으로 의미를 명시하면 좋다.

---

### [INFO] consistency/review MD 파일들 — 유지보수성 관점 해당 없음
- 위치: `review/consistency/2026/06/28/14_36_34/` 하위 파일들
- 상세: 리뷰 산출물(SUMMARY, cross_spec, convention_compliance 등)은 생성 문서이므로 코드 유지보수성 관점의 평가 대상에서 제외한다. 내용 품질은 consistency-checker 역할 범주다.

---

## 요약

이번 변경의 핵심 코드 변경은 두 가지다: (1) `EmbedConfigDto` 필드에 JSDoc 병기, (2) `configFromQuery` 내 `apiBase` 처리를 `safeApiBaseFromQuery` 로 추출·export 하고 5개 단위 테스트 추가. 두 변경 모두 함수 분리·문서화 방향으로 유지보수성을 개선한다. `safeApiBaseFromQuery` 는 단일 책임·짧은 함수 길이·명확한 JSDoc 을 갖추고 있으며, 테스트도 케이스별 의도가 명확하게 기술됐다. 유일하게 주목할 점은 JSDoc 과 `@ApiProperty.description` 의 내용 중복(drift 위험)이지만 프로젝트 swagger 컨벤션에 따라 결정할 사항이며 차단 수준이 아니다. Pre-existing god hook 구조는 본 변경 범위 외이므로 별도 추적으로 충분하다.

## 위험도

NONE
