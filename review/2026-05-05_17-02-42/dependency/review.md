## 발견사항

---

### **[CRITICAL]** `@radix-ui/react-focus-scope`가 `devDependencies`에 잘못 배치됨
- **위치**: `frontend/package.json` L65, `frontend/src/components/ui/slide-drawer.tsx`
- **상세**: `FocusScope`는 프로덕션 컴포넌트(`slide-drawer.tsx`)에서 직접 import하여 사용되지만, `@radix-ui/react-focus-scope@^1.1.8`이 `devDependencies`에 등록되어 있음. `npm install --production` 또는 CI/CD에서 dev 의존성을 제외하는 경우 런타임에 모듈을 찾지 못해 빌드/실행이 실패함.
- **제안**: `devDependencies` → `dependencies`로 이동

```json
// package.json - dependencies 블록으로 이동
"@radix-ui/react-focus-scope": "^1.1.8"
```

---

### **[WARNING]** `@radix-ui/react-focus-scope` 중복 인스턴스 발생
- **위치**: `frontend/package-lock.json` (focus-scope 관련 섹션 전체)
- **상세**: 최상위 `node_modules/@radix-ui/react-focus-scope`는 `1.1.8`로 올라갔으나, `@radix-ui/react-dialog`, `@radix-ui/react-menu`, `@radix-ui/react-popover`는 각각 자체 하위 경로에 `1.1.7`을 별도 설치함. 동일 패키지의 두 버전이 번들에 포함되어 불필요한 용량 증가와 잠재적 동작 불일치 발생.
- **제안**: 최상위 버전을 `~1.1.7`로 유지하거나, 내부 Radix 컴포넌트들의 resolution이 1.1.8로 통일되는지 확인 후 결정. 또는 직접 의존성 선언 없이 Radix dialog가 이미 transitively 포함하는 버전을 활용하는 방안 검토.

---

### **[WARNING]** `@axe-core/playwright` 라이선스 MPL-2.0 확인 필요
- **위치**: `frontend/package.json`, `frontend/package-lock.json`
- **상세**: MPL-2.0(Mozilla Public License 2.0)은 약한 카피레프트 라이선스로, **수정 후 배포 시** 변경된 파일을 동일 라이선스로 공개해야 함. 프로젝트가 클로즈드 소스이고 이 라이브러리를 수정할 가능성이 없다면 실질적 문제는 없음(dev-only이므로 배포 산출물에 포함되지 않음). 그러나 라이선스 정책 검토가 권장됨.
- **제안**: 라이선스 담당자에게 MPL-2.0 dev 의존성 허용 여부 확인.

---

### **[INFO]** `three` 버전 범위 축소: `^0.184.0` → `~0.184.0`
- **위치**: `frontend/package.json` L58
- **상세**: caret(`^`)에서 tilde(`~`)로 변경 시 마이너 업데이트가 차단됨. `three`는 마이너 릴리즈에서 breaking change가 발생하는 경향이 있어 patch-only 고정이 안정성 측면에서 합리적인 선택임.
- **제안**: 현행 유지 적절.

---

### **[INFO]** `axe-core` 4.11.1 → 4.11.4 패치 업그레이드
- **위치**: `frontend/package-lock.json` L4939
- **상세**: `@axe-core/playwright`의 peer dep(`~4.11.4`)을 충족하기 위해 패치 업그레이드됨. 패치 범위이므로 breaking change 없음.
- **제안**: 현행 유지 적절.

---

### **[INFO]** Playwright 관련 의존성의 번들 영향 없음
- **위치**: `frontend/package-lock.json` (playwright, playwright-core 섹션)
- **상세**: `@playwright/test@1.59.1` + `playwright@1.59.1` + `playwright-core@1.59.1`는 `devOptional`로 표시되어 있어 프로덕션 번들에 포함되지 않음. Node.js >=18 요구사항은 현대 Next.js 프로젝트 기준 충족.

---

## 요약

이번 변경의 의존성 관점 핵심 이슈는 **`@radix-ui/react-focus-scope`의 잘못된 `devDependencies` 배치**이다. 해당 패키지는 프로덕션 컴포넌트(`slide-drawer.tsx`)에서 직접 사용되므로 반드시 `dependencies`로 옮겨야 하며, 그렇지 않으면 프로덕션 환경에서 런타임 오류가 발생한다. 부수적으로 동일 패키지의 두 버전(1.1.7/1.1.8)이 동시 존재하는 중복 문제도 있으나 기능상 치명적이지는 않다. Playwright 및 axe-core 도입 자체는 dev-only 사용으로 프로덕션 번들에 영향을 주지 않고, 라이선스도 Apache-2.0/MPL-2.0으로 dev 용도에 한해 무리 없다.

## 위험도

**HIGH** — `@radix-ui/react-focus-scope`의 `devDependencies` 오분류로 인해 프로덕션 배포 환경에서 실제 빌드/런타임 오류 발생 가능.