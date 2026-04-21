## 의존성 리뷰

### 발견사항

---

**[INFO]** `@radix-ui/react-dialog` — 신규 UI 컴포넌트 의존성
- 위치: `frontend/src/components/ui/dialog.tsx`
- 상세: Radix UI Dialog primitive를 래핑한 `dialog.tsx`가 신규 추가됨. 프로젝트가 이미 Radix UI 계열(`@radix-ui/react-tabs` 등)을 사용 중이라면 기존 설치된 패키지를 재사용하는 것이므로 추가 번들 부담 없음. 단, `package.json`에 `@radix-ui/react-dialog`가 명시되어 있는지 확인 필요.
- 제안: `frontend/package.json`에 `@radix-ui/react-dialog`가 선언되어 있는지 확인.

---

**[INFO]** `@radix-ui/react-tabs` — 신규 UI 컴포넌트 의존성
- 위치: `frontend/src/components/ui/tabs.tsx`
- 상세: `tabs.tsx`가 신규 추가됨. Dialog와 동일하게 Radix UI 패밀리이므로 호환성 문제는 낮음. 단, `package.json` 미선언 시 런타임 에러.
- 제안: `frontend/package.json`에 `@radix-ui/react-tabs`가 선언되어 있는지 확인.

---

**[INFO]** `class-validator` (`@IsOptional`, `@IsString`, `@MinLength`, `@MaxLength`) — 기존 의존성 확장
- 위치: `backend/src/modules/workspaces/dto/update-workspace.dto.ts`
- 상세: NestJS 프로젝트에서 이미 사용 중인 `class-validator` 데코레이터를 활용한 것으로, 신규 의존성 추가 없음. 패턴 일관성 측면에서 적절함.

---

**[INFO]** `roleLabelKey` 함수 중복 정의
- 위치: `frontend/src/app/(main)/workspace/settings/page.tsx:48-58`, `frontend/src/components/layout/sidebar.tsx:20-30`
- 상세: `roleLabelKey` 함수가 두 파일에 동일하게 중복 정의되어 있음. 의존성 문제는 아니지만 내부 모듈 의존 구조 측면에서 공유 유틸리티로 추출하지 않은 점이 향후 불일치 위험을 만듦.
- 제안: `frontend/src/lib/utils/workspace.ts` 등 공유 모듈로 추출하고 두 파일에서 import.

---

**[INFO]** `translate` 함수와 `useLocaleStore` — 비훅 컨텍스트에서의 직접 스토어 접근
- 위치: `frontend/src/lib/providers.tsx:47-52`
- 상세: `useEffect` 내부 zustand 구독 콜백에서 `useLocaleStore.getState()`를 직접 호출하는 패턴. 훅이 아닌 컨텍스트에서의 스토어 접근이므로 zustand의 설계 의도에 부합하며 안전함. 단, `translate` 함수가 `@/lib/i18n`에서 정상 export되는지 확인 필요.
- 제안: 문제 없음. 현재 패턴 유지.

---

**[WARNING]** `UpdateWorkspaceDto` DTO에서 `class-validator` 길이 검증과 서비스 레이어 검증 중복
- 위치: `backend/src/modules/workspaces/dto/update-workspace.dto.ts:8-9`, `backend/src/modules/workspaces/workspaces.service.ts:260-264`
- 상세: DTO의 `@MinLength(2) @MaxLength(100)`과 서비스의 `trimmed.length < 2 || trimmed.length > 100` 검증이 이중으로 존재함. DTO 검증은 trim 전 raw value 기준, 서비스 검증은 trim 후 기준으로 동작하므로 `" A"` 같은 공백 포함 2자 입력이 DTO는 통과하지만 서비스에서 차단됨. 이중 검증 자체는 의존성 문제가 아니나, 검증 책임 분산으로 인한 예측 불가 동작.
- 제안: DTO에 `@Transform(({ value }) => value?.trim())` 추가하거나, 서비스 검증을 제거하고 DTO에 일임.

---

### 요약

이번 변경에서 추가된 실질적 외부 의존성은 `@radix-ui/react-dialog`와 `@radix-ui/react-tabs` 두 패키지이며, 둘 다 이미 프로젝트에서 사용 중인 Radix UI 패밀리에 속해 라이선스(MIT), 호환성, 번들 증가 측면에서 위험이 낮습니다. 나머지 변경은 모두 기존 의존성(`class-validator`, `lucide-react`, `@tanstack/react-query`, `zustand`, `sonner`)의 활용 범위를 확장한 것으로, 신규 취약점이나 버전 충돌 우려는 없습니다. 단, `package.json`에서 두 Radix 패키지 선언 여부를 반드시 확인하고, `roleLabelKey` 함수의 중복 정의는 내부 의존 구조 관점에서 공유 유틸로 통합할 것을 권장합니다.

### 위험도

**LOW**