# Dependency Review

## 발견사항

### [INFO] 새 외부 패키지 없음 — 기존 의존성만 활용
- 위치: `codebase/frontend/package.json`, `codebase/channel-web-chat/package.json`, `codebase/backend/package.json`
- 상세: 이번 변경에서 추가된 새 외부 패키지는 없다. `sonner`(토스트 알림)는 이미 `codebase/frontend/package.json` dependencies 에 `"^2.0.7"` 로 등록돼 있다. `class-validator`(`IsObject`, `ValidateNested`, `Matches`, `IsBoolean`, `Transform`), `class-transformer`(`Type`, `Transform`), `@nestjs/swagger`(`ApiPropertyOptional`) 모두 기존 backend 의존성의 새 심볼 추가다. `@testing-library/*`, `vitest`, `@playwright/test`도 기존 devDependencies.
- 제안: 해당 없음.

### [INFO] `build:widget` 스크립트 추가 — 배포 단계 의존 명문화
- 위치: `codebase/frontend/package.json` `scripts.build:widget`
- 상세: `node scripts/copy-widget.mjs`를 실행하는 스크립트를 추가했다. 이 스크립트는 `pnpm --filter channel-web-chat build` 및 `pnpm --filter @workflow/web-chat build:loader`를 내부적으로 호출하므로 `channel-web-chat`과 `@workflow/web-chat` 패키지에 대한 빌드-타임 의존이 생긴다. 이는 Docker 이미지 빌드 순서에 영향을 미치며, Dockerfile과 k8s/README.md에 전제 조건으로 명문화됐다.
- 제안: 해당 없음. 의존 관계가 문서화됐으며 설계 의도에 부합한다.

### [INFO] 내부 모듈 의존 관계 — 공유 타입 파일 신설
- 위치: `codebase/frontend/src/lib/types/trigger.ts` (신규)
- 상세: `TriggerType`, `InteractionTokenStrategy`, `WebChatAppearanceConfig`, `TriggerInteractionConfig`, `TriggerConfig`, `TriggerListItem` 를 단일 모듈로 추출했다. 기존에 `use-web-chat.ts`, `trigger-detail-drawer.tsx`, `triggers/page.tsx` 가 각자 로컬 인터페이스로 중복 정의하던 것을 제거한다. 이 파일은 순수 타입 선언만 포함하므로 런타임 번들 크기에 영향이 없다.
- 제안: 해당 없음.

### [INFO] `class-transformer`의 `Transform` 데코레이터 사용 — 기존 의존성 심볼 확장
- 위치: `codebase/backend/src/modules/triggers/dto/query-trigger.dto.ts`
- 상세: `@Transform(({ value }) => value === true || value === 'true')` 로 query string `'false'`를 올바르게 `false`로 변환한다. 코드 주석에 `@Type(() => Boolean)`의 비어있지 않은 문자열 전부를 `true`로 해석하는 함정이 명시됐으며, 명시적 `Transform`이 이를 회피한다. `class-transformer`는 이미 `^0.5.1`로 핀됨.
- 제안: 해당 없음.

### [INFO] `sonner` toast — 기존 패키지의 새 사용처 추가
- 위치: `codebase/frontend/src/app/(main)/web-chat/page.tsx`, `codebase/frontend/src/components/web-chat/__tests__/create-web-chat-dialog.test.tsx`
- 상세: `sonner`는 이미 `dependencies`에 `"^2.0.7"`로 등록돼 있으며 다른 화면에서도 사용 중이다. 이번 변경은 웹채팅 페이지와 생성 다이얼로그 테스트에서 `toast.success` / `toast.error`를 추가하는 것뿐이다.
- 제안: 해당 없음.

### [INFO] `e2e/helpers/mock-auth.ts` 신규 — 프로젝트 내부 헬퍼 모듈화
- 위치: `codebase/frontend/e2e/helpers/mock-auth.ts` (신규)
- 상세: `console.spec.ts`와 `workflows/list.spec.ts` 각각에 중복 정의됐던 `mockAuth`, `ACCESS`, `USER`, `WORKSPACE` 상수를 단일 헬퍼로 추출했다. `@playwright/test` 외 추가 의존성 없음.
- 제안: 해당 없음.

## 요약

이번 변경에서 새로 추가된 외부 패키지는 없다. 모든 기능은 `class-validator`, `class-transformer`, `@nestjs/swagger`, `sonner`, `@tanstack/react-query`, `@playwright/test` 등 이미 등록된 의존성의 기존 심볼 또는 API를 활용한다. `build:widget` 스크립트 추가로 인한 `channel-web-chat`·`@workflow/web-chat` 빌드-타임 의존 관계가 생기지만 Dockerfile과 k8s/README.md에 명문화됐다. 신규 타입 파일(`lib/types/trigger.ts`)은 타입 전용 모듈이므로 번들 크기 영향이 없다. 버전 충돌, 라이선스 비호환, 알려진 취약점, 불필요한 의존성 추가는 발견되지 않았다.

## 위험도
NONE
