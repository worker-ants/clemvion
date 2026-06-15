# 부작용(Side Effect) 리뷰 결과

## 발견사항

### **[INFO]** `registerDecorator` 전역 레지스트리 등록 — 의도된 동작
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts` 전체
- 상세: `IsIpOrCidr()` 데코레이터 팩토리가 내부에서 `class-validator`의 `registerDecorator`를 호출한다. 이 함수는 class-validator의 전역 메타데이터 저장소(`MetadataStorage`)에 제약 정보를 등록하는 부작용을 가진다. 이는 class-validator 데코레이터의 표준 동작 방식이므로 의도된 부작용이다. 그러나 동일 클래스·프로퍼티에 데코레이터가 중복 적용될 경우 메타데이터가 중복 등록될 수 있다 — 현재 코드에서는 `CreateAuthConfigDto.ipWhitelist`와 `UpdateAuthConfigDto.ipWhitelist` 각각에 한 번씩만 적용되므로 문제없다.
- 제안: 현 사용 방식은 안전하다. 별도 조치 불필요.

### **[INFO]** `@ValidatorConstraint({ async: false })` — NestJS DI 우회
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts` Line 43
- 상세: `IsIpOrCidrConstraint`는 `@ValidatorConstraint`로 등록되지만, `registerDecorator`에서 `validator: IsIpOrCidrConstraint`(클래스 참조)를 전달한다. class-validator는 이 경우 NestJS DI 컨테이너가 아닌 내부 인스턴스화(`new IsIpOrCidrConstraint()`)를 사용한다. 해당 클래스가 Stateless(인스턴스 필드 없음)로 명시적으로 설계되어 있으므로 DI 우회로 인한 부작용은 없다. 코멘트에도 "Stateless — instance field 회피 (class-validator singleton 패턴의 race 회피)"로 명시되어 있다.
- 제안: 현 설계가 적절하다. 별도 조치 불필요.

### **[INFO]** `useEffect` 타이머 부작용 — 이전 `window.setTimeout` 직접 호출 제거
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/page.tsx` Lines 1056-1072 (신규 추가), Line 1082-1083 (제거)
- 상세: 이전 코드에서 `revealMutation.onSuccess` 콜백 내부에서 `window.setTimeout(() => setRevealedSecret(null), 30_000)`을 직접 호출했다. 이 방식은 cleanup 없이 타이머 참조를 버리므로 언마운트 후 `setRevealedSecret`이 호출되는 stale timer 문제가 존재했다. 변경 후에는 두 `useEffect`(`generatedKey` 의존, `revealedSecret` 의존)가 각각 `window.clearTimeout(timer)`를 cleanup으로 반환하므로 타이머 누수가 제거된다. `generatedKey`에 대한 자동 클리어도 신규 추가되어 create/regenerate 경우에도 동일 정책이 적용된다. 이는 의도된 개선이며 부작용 관점에서 긍정적 변경이다.
- 제안: 별도 조치 불필요.

### **[INFO]** `useEffect` 의존성 배열 — `generatedKey`/`revealedSecret` 값 변경 시 재실행
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/page.tsx` Lines 1056-1072
- 상세: `useEffect([generatedKey])`는 `generatedKey`가 변경될 때마다 실행된다. 만약 타이머 만료 전에 새로운 `generatedKey` 값이 세팅되면(예: regenerate 연속 호출), 이전 cleanup이 먼저 수행되어 기존 타이머가 취소되고 새 타이머가 시작된다. 이는 의도한 동작으로 보이며, 이전 코드에서 timer를 버리던 문제를 오히려 개선했다. 다만, `generatedKey`가 null→"값"→null 순서로 두 번 변경되는 경우, null에서는 `if (!generatedKey) return;` 가드로 타이머를 설정하지 않아 중복 타이머가 발생하지 않는다.
- 제안: 별도 조치 불필요.

### **[INFO]** `CreateAuthConfigDto`·`UpdateAuthConfigDto` — 기존 API 요청에 대한 검증 강화
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/backend/src/modules/auth-configs/dto/create-auth-config.dto.ts` Line 384, `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` Line 633
- 상세: `@IsIpOrCidr({ each: true })` 추가로 기존에 `@IsString({ each: true })`만 통과하던 요청 중 유효하지 않은 IP/CIDR 형식이 포함된 경우 이제 400으로 거부된다. 이는 입력 검증 강화로 의도된 breaking change이다. 단, 기존 DB에 이미 저장된 `ipWhitelist` 데이터는 영향받지 않는다(저장 시에만 검증). 기존 클라이언트가 `ipWhitelist`에 도메인명(예: `example.com`) 또는 잘못된 형식을 전송하던 경우 동작이 변경된다.
- 제안: 스펙(`spec/1-data-model.md §2.17`) 기준으로 의도된 변경이므로 문제없다. 기존 클라이언트 호환성 파악 필요 여부는 배포 컨텍스트에 따라 판단할 것.

### **[INFO]** `spec/1-data-model.md` 변경 — Spec 파일 직접 수정
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/spec/1-data-model.md` Line 2202
- 상세: `ip_whitelist` 필드 설명에 "저장(create/update) 시 각 항목을 형식 검증하며 단일 IP/CIDR(IPv4·IPv6) 가 아니면 400 으로 거부한다" 내용이 추가됐다. 이는 스펙 문서 변경이므로 파일시스템 부작용 관점의 영향은 없다. 단, CLAUDE.md에 따르면 `spec/` 쓰기는 `project-planner` 역할만 허용되나, 이 변경이 `developer` 워크트리에서 이루어졌다면 역할 규약 위반이다. 리뷰 범위 외이므로 참고 정보로만 기록한다.
- 제안: 워크트리 역할 규약 준수 여부를 확인할 것.

### **[INFO]** 테스트 파일에서 `useLocaleStore.setState` 직접 호출
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/__tests__/generated-key-autoclear.test.tsx` Lines 893, 908, 929, 969
- 상세: `useLocaleStore.setState({ locale: "en" })`를 `beforeEach`와 `afterEach`에서 호출한다. 이는 Zustand 스토어의 전역 상태를 직접 변경하는 부작용이다. `afterEach`에서 복원하고 있어 테스트 간 격리는 유지된다. 단, 다른 테스트가 같은 프로세스에서 병렬 실행될 경우(Vitest의 concurrent 모드) 경쟁 조건이 발생할 수 있다. 현재 `describe` 블록이 `concurrent` 없이 순차 실행되므로 문제없다.
- 제안: 별도 조치 불필요. 단, 향후 `concurrent` 모드 도입 시 주의 필요.

## 요약

이번 변경은 크게 두 가지 기능을 추가한다: (1) 백엔드 DTO에 `@IsIpOrCidr` 검증 데코레이터를 추가해 IP 화이트리스트 입력 형식을 저장 시점에 강제하고, (2) 프론트엔드 Authentication 페이지에서 평문 비밀값(`generatedKey`, `revealedSecret`)의 30초 자동 클리어를 기존 `setTimeout` 직접 호출에서 `useEffect` + cleanup 패턴으로 리팩토링한다. 부작용 관점에서 주목할 의도치 않은 상태 변경이나 전역 변수 오염은 없다. `registerDecorator`의 전역 메타데이터 등록은 class-validator의 정상 동작이고, `useEffect` cleanup으로 타이머 누수가 오히려 제거됐다. DTO 검증 강화는 기존 무효 IP 형식 입력을 허용하던 동작을 변경하지만, 이는 spec에 명시된 의도된 breaking change다.

## 위험도

LOW
