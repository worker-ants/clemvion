# 의존성(Dependency) 리뷰 — commit a8c9460564df00131fcb39c516d9ee8ca6a3383b

## 대상 커밋 범위 확인

`git show --name-status a8c9460564df00131fcb39c516d9ee8ca6a3383b` 로 실측한 결과 변경 파일은 정확히 payload 의 7개와 일치한다:

```
M  codebase/backend/Dockerfile
M  codebase/frontend/Dockerfile.playwright-e2e
M  codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts
M  codebase/frontend/src/components/editor/run-results/output-shape.ts
A  codebase/frontend/src/lib/conversation/__tests__/interaction-type-registry.test.ts
M  codebase/packages/ai-end-reason/README.md
M  plan/in-progress/is-conversation-output-restructure.md
```

`package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` 등 의존성 매니페스트는 **이 커밋에서 단 1개도 건드리지 않는다**. 즉 이번 diff 는 이전 커밋(`f0ef4a821` `feat(packages): @workflow/ai-end-reason — endReason drift 를 구조적으로 차단`)에서 이미 신설·배선된 내부 패키지를 대상으로 한 **문서·테스트·주석 정리 follow-up**이며, 신규 의존성 추가/버전 변경/배선 변경이 없다.

## 발견사항

- **[INFO]** 신규 외부/내부 의존성 없음
  - 위치: 전체 diff (7 파일)
  - 상세: 변경 유형은 (1) 테스트 추가 2건(`output-shape.test.ts` 신규 케이스, `interaction-type-registry.test.ts` 신규 파일), (2) JSDoc 재배치·고아 주석 삭제(`output-shape.ts`), (3) README 문서 섹션 추가(`ai-end-reason/README.md`), (4) plan 각주 정정, (5) Dockerfile 주석 숫자 정정(4→5, 6→7) 뿐이다. `import` 구문·`package.json`·`pnpm-lock.yaml` 은 diff 에 전혀 등장하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** Dockerfile 주석 정정의 사실관계 검증 완료 — 실제 COPY 명령과 일치
  - 위치: `codebase/backend/Dockerfile`, `codebase/frontend/Dockerfile.playwright-e2e`
  - 상세: 두 Dockerfile 의 "전체 파일 컨텍스트" 를 직접 세어 교차검증했다. backend closure 소스 COPY 는 `ai-end-reason / expression-engine / node-summary / chat-channel-validation / graph-warning-rules` 5개로 "5개" 주석과 일치. frontend e2e Dockerfile 의 manifest COPY(`codebase/packages/*/package.json`) 는 위 5개 + `sdk` + `web-chat-sdk` = 7개로 "7개" 주석과 일치. 커밋 메시지의 "실제 COPY/manifest 는 정확, 주석만 stale" 주장이 실측과 부합하며, **실제 빌드 동작(RUN/COPY 인스트럭션)은 이번 diff 에서 전혀 변경되지 않았다** — 변경된 라인은 모두 `#` 주석 내부다. Docker 빌드 캐시·레이어·이미지 크기에 영향 없음.
  - 제안: 조치 불필요. (참고: backend/frontend 두 Dockerfile 의 실제 5-패키지 closure 목록이 서로 동일함을 확인 — `@workflow/ai-end-reason` 이 양쪽에 정확히 포함돼 있어 E-5 배선표(plan 내 표)와 실물이 정합한다.)

- **[INFO]** 내부 패키지 `@workflow/ai-end-reason` 자체는 이번 diff 범위 밖이나, 형제 패키지와 버전 일치 확인
  - 위치: `codebase/packages/ai-end-reason/package.json` (diff 밖, 참고용 확인)
  - 상세: `git log`로 실측한 결과 이 패키지의 신설·`workspace:*` 배선은 선행 커밋 `f0ef4a821`에서 이미 완료됐고, 그 `package.json` 의 `devDependencies` (`@eslint/js ^9.18.0`, `@types/jest ^30.0.0`, `eslint ^9.18.0`, `globals ^16.0.0`, `jest ^30.0.0`, `ts-jest ^29.2.5`, `typescript ^5.7.3`, `typescript-eslint ^8.20.0`)는 커밋 메시지가 "최소 템플릿"으로 지목한 `@workflow/graph-warning-rules/package.json` 과 **완전히 동일**하다(diff 없음, byte 단위 일치). 4개 형제 내부 패키지 전체가 같은 버전 세트를 공유하는 기존 패턴이 유지되어 워크스페이스 내 버전 충돌 위험이 없다.
  - 제안: 조치 불필요. (이번 리뷰 diff 자체에는 해당 파일이 없으므로 등급 부여 대상 아님 — 교차검증 목적의 참고 기록.)

- **[INFO]** 신규 테스트가 참조하는 심볼은 모두 기존에 이미 존재하던 import
  - 위치: `output-shape.test.ts:346-365`(신규 케이스), `interaction-type-registry.test.ts`(신규 파일)
  - 상세: 새 테스트 2건은 `@workflow/ai-end-reason` 의 `CONVERSATION_END_REASONS`(파일 상단에 이미 import, diff 밖)와 `@/lib/conversation/interaction-type-registry` 의 `MULTI_TURN_INTERACTION_TYPES`(신규 테스트 파일에서 처음 import 하지만, 이 내부 모듈 자체는 기존에 이미 존재)를 사용한다. `vitest` 도 기존 devDependency. 신규 test 러너·assertion 라이브러리 추가 없음.
  - 제안: 조치 불필요.

## 요약

이번 diff(commit a8c9460564df00131fcb39c516d9ee8ca6a3383b)는 선행 커밋에서 이미 신설·배선된 내부 패키지 `@workflow/ai-end-reason` 을 대상으로 한 **순수 정리 커밋**이다 — 테스트 2건 추가, JSDoc 재배치, README 문서 보강, plan 각주 정정, Dockerfile 주석의 숫자 drift(4→5, 6→7) 교정으로 구성되며 `package.json`/`pnpm-lock.yaml`/워크스페이스 매니페스트는 전혀 건드리지 않는다. 신규 외부 의존성, 버전 변경, 라이선스 이슈, 취약점 노출, 번들/빌드 크기 영향, 호환성 충돌이 전무하며, Dockerfile 주석 수정 내용도 실제 COPY 인스트럭션과 대조 검증한 결과 사실과 일치한다(실제 동작 변경 없음, 주석만 정정). 참고로 확인한 `@workflow/ai-end-reason` 자체(선행 커밋 범위)도 형제 패키지와 devDependency 버전이 완전히 일치해 워크스페이스 버전 충돌 위험이 없다. 의존성 관점에서 지적할 CRITICAL/WARNING 사항이 없다.

## 위험도

NONE
