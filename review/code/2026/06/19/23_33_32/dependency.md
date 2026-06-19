# 의존성(Dependency) 리뷰 결과

## 발견사항

### **[INFO]** 새 의존성 추가 없음 — 기존 의존성 버전 상향 및 overrides 추가
- 위치: 전 workspace package.json
- 상세: 이번 변경은 새 외부 패키지를 추가하지 않고, 기존 직접·전이 의존성을 보안 취약점 해소 목적으로 상향 고정하거나 `overrides`를 통해 강제한 패치·마이너 업그레이드다.
- 제안: 없음 (정상)

---

### **[INFO]** nodemailer 메이저 업그레이드 (^8.0.4 → ^9.0.1)
- 위치: `codebase/backend/package.json` 직접 의존성
- 상세: `nodemailer` v9는 raw 옵션 파일읽기/SSRF(`<=9.0.0`) 취약점을 해소한다. 메이저 버전 변경이므로 API breaking change 가능성이 있다. CHANGELOG는 "소스 코드 변경 없음, build·unit·e2e 통과"라고 명시하므로 실제로 API 변경 영향이 없거나 이미 검증된 것으로 보인다.
- 제안: `nodemailer` v9 릴리스 노트의 breaking change를 다시 한번 교차 확인 권장. 특히 메일 전송 옵션(`auth`, `transporter` 설정) 변경 여부를 점검.

---

### **[INFO]** overrides 섹션에 `nodemailer ^9.0.1` 중복 선언 (의도된 이중 강제)
- 위치: `codebase/backend/package.json` `overrides.nodemailer`
- 상세: 직접 의존성으로 `^9.0.1`을 선언하면서 `overrides`에도 동일 버전을 추가했다. 주석(`//security-overrides`)에서 "preview-email/mailparser 가 nodemailer@8(취약)을 중첩 설치하므로 두 중첩 사본까지 9로 강제"라고 명확히 설명하고 있어 의도된 패턴이다.
- 제안: 혼동을 피하기 위해 주석이 이미 충분히 존재하므로 추가 조치 불필요. 그러나 `preview-email` 기능이 향후 활성화될 경우 이 override를 재검토해야 한다.

---

### **[INFO]** @opentelemetry/* 마이너 업그레이드 (0.218→0.219, core 2.7→2.8) + 신규 서브패키지 3종
- 위치: `codebase/backend/package.json` + package-lock.json
- 상세:
  - `@opentelemetry/instrumentation-host-metrics` ^0.2.0 — `@opentelemetry/auto-instrumentations-node@0.77.0`의 새 전이 의존성. `systeminformation@^5.31.6`을 추가로 끌어들인다.
  - `@opentelemetry/propagator-aws-xray` 2.2.0 — `instrumentation-aws-lambda@0.71.0`의 새 전이 의존성.
  - `@opentelemetry/otlp-grpc-exporter-base` 0.219.0 — `sdk-node@0.219.0`의 신규 직접 의존성 (이전에는 없었음).
  - 세 패키지 모두 Apache-2.0 라이선스.
  - `@opentelemetry/propagator-aws-xray@2.2.0`의 peerDependency는 `@opentelemetry/api >=1.0.0 <1.10.0`로 제한. 현재 프로젝트는 `^1.9.0`을 사용하므로 호환 범위 내.
- 제안: `systeminformation` 패키지가 새로 포함됨. 번들/런타임에 네이티브 바인딩이 없는 순수 JS 패키지이므로 크기 영향은 경미하다. 보안 이력도 현재 알려진 취약점 없음.

---

### **[INFO]** frontend overrides에 `vite ^8.0.16` 추가
- 위치: `codebase/frontend/package.json` overrides
- 상세: vite 전이 의존성을 ^8.0.16으로 강제. 해당 버전 구간은 알려진 취약점 패치를 포함한다. lock에서 실제 해소된 버전은 8.0.16.
- 제안: vite는 devDependency이며 번들에 포함되지 않는다. 영향 없음.

---

### **[INFO]** frontend overrides에 `undici ^7.28.0` 추가 (TLS 검증 우회 취약점 해소)
- 위치: `codebase/frontend/package.json` overrides
- 상세: undici는 Node.js 내장 HTTP 클라이언트이자 next.js 전이 의존성. TLS 검증 우회 취약점을 해소한다. 런타임 프런트엔드 번들에는 포함되지 않고 빌드 시에만 사용됨.
- 제안: 없음.

---

### **[INFO]** js-yaml(moderate) accept 결정
- 위치: CHANGELOG.md `잔여(accept)` 섹션
- 상세: `gray-matter@4`가 `js-yaml@3.x`의 `safeLoad` API에 의존하여 forward 불가. 빌드타임 신뢰 입력(자체 docs frontmatter)만 파싱하므로 실위험 없음으로 판단했다.
- 제안: 이 판단은 타당하다. 단, `gray-matter@5`(js-yaml@4 지원) 릴리스 여부를 주기적으로 확인하여 업그레이드 기회를 놓치지 않도록 트래킹 권장.

---

### **[INFO]** backend @babel/core(low) accept 결정
- 위치: CHANGELOG.md `잔여(accept)` 섹션
- 상세: 빌드타임 신뢰 입력에만 사용되는 low severity 취약점으로 accept.
- 제안: 타당한 판단. frontend는 override로 @babel/core ^7.29.7을 강제했으므로 일관성 문제는 없다.

---

### **[INFO]** channel-web-chat의 dompurify exact pin 유지
- 위치: `codebase/channel-web-chat/package.json`
- 상세: `dompurify` 3.4.7 → 3.4.11 exact pin 업데이트. 보안 패치(XSS)를 적용하면서 기존 exact pin 정책(`PROJECT.md §버전 핀 정책`의 sanitize 경로 무결성 원칙)을 유지했다.
- 제안: 적절함. exact pin은 supply chain 무결성 측면에서 sanitize 라이브러리에 특히 권장되는 패턴이다.

---

### **[INFO]** package-lock.json libc 필드 제거 (channel-web-chat)
- 위치: `codebase/channel-web-chat/package-lock.json`
- 상세: 다수의 optional 패키지에서 `"libc": ["glibc"]` / `"libc": ["musl"]` 필드가 제거됨. npm lock 파일 스펙 변경 또는 npm 버전 업그레이드에 따른 자동 재생성으로 보인다.
- 제안: 의존성 내용 변경이 아니라 lock 파일 포맷 정규화이다. 실행 환경의 npm 버전이 일치하는 한 문제없음. CI 환경의 npm 버전이 이 포맷을 지원하는지 확인 권장.

---

### **[INFO]** 버전 고정(pinning) 방식 일관성
- 위치: 전 workspace overrides 섹션
- 상세: 직접 의존성은 `^` 범위 지정, overrides는 `^` 범위 지정 또는 exact pin 혼용. channel-web-chat의 `dompurify`만 exact pin. 기존 정책과 일관됨.
- 제안: 현재 패턴이 프로젝트 정책(`//pin` 주석 참조)과 일치하므로 변경 불필요.

---

### **[INFO]** 라이선스 검토
- 위치: 신규 추가 전이 의존성 전체
- 상세:
  - `@opentelemetry/instrumentation-host-metrics@0.2.0` — Apache-2.0
  - `systeminformation@^5.31.6` — MIT
  - `@opentelemetry/propagator-aws-xray@2.2.0` — Apache-2.0
  - `@opentelemetry/otlp-grpc-exporter-base@0.219.0` — Apache-2.0
  - 기타 변경된 기존 패키지 라이선스 유지 (MIT, Apache-2.0, ISC)
- 제안: 모든 신규 전이 의존성 라이선스가 오픈소스(MIT/Apache-2.0)로 프로젝트와 호환.

---

## 요약

이번 변경은 신규 외부 패키지 도입 없이 기존 의존성의 보안 취약점(high/critical 총 74건: backend 63, frontend 9, channel-web-chat 2)을 해소하기 위한 버전 상향 및 `overrides` 추가로 구성된다. 직접 의존성 상향(`nodemailer` 메이저, `dompurify`, `@nestjs-modules/mailer`, `@opentelemetry/*`)은 명확한 취약점 CVE와 연결되어 있고, 전이 의존성(`ws`, `@grpc/grpc-js`, `multer`, `form-data`, `protobufjs`, `undici`, `vite`, `@babel/core`)은 부모가 핀으로 막혀 forward가 불가한 경우에 한해 `overrides`로 강제했다. 잔여 accept 항목(`js-yaml` moderate, backend `@babel/core` low)은 모두 빌드타임 신뢰 입력에만 노출되어 실위험이 없다는 충분한 근거를 갖추고 있다. `@opentelemetry/auto-instrumentations-node@0.77.0` 업그레이드로 인해 `instrumentation-host-metrics`(`systeminformation` 포함)와 `propagator-aws-xray` 두 개의 신규 전이 의존성이 유입되었으나 모두 Apache-2.0·MIT 라이선스이고 알려진 취약점이 없어 수용 가능하다. 소스 코드 변경 없이 build·unit·e2e가 통과했다는 검증 완료 사실이 CHANGELOG에 명시되어 있어 전체적으로 의존성 관리가 체계적으로 수행되었다.

## 위험도

LOW
