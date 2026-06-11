# 의존성(Dependency) 리뷰

**대상**: code-node-isolated-vm 브랜치 — `isolated-vm@6.1.2` 신규 추가 및 관련 구현 변경
**검토 일시**: 2026-06-11

---

## 발견사항

### **[INFO]** 새 의존성 — `isolated-vm@6.1.2` 추가 필요성 명확
- **위치**: `codebase/backend/package.json:65`, `package-lock.json`
- **상세**: `node:vm` 의 prototype-chain escape 취약점(host-takeover 가능성)을 구조적으로 해소하기 위한 V8 Isolate 기반 샌드박스 라이브러리 도입. spec §7.1 로드맵이 지정한 경로이며, 플랜 파일에 사용자 결정(2026-06-11, 옵션 A) 근거가 명문화되어 있다. 보안 목적 의존성 추가로 필요성 충분.
- **제안**: 없음.

---

### **[INFO]** 버전 고정 — caret(`^`) 사용
- **위치**: `codebase/backend/package.json:65` — `"isolated-vm": "^6.1.2"`
- **상세**: 기존 프로젝트 의존성 대부분이 caret(`^`) 방식을 사용하는 관례와 일관된다. `package-lock.json` 에는 `"version": "6.1.2"` 로 정확한 버전이 고정되어 lockfile 재현성은 보장된다. 단, `^6.1.2` 허용 범위(`<7.0.0`)에서 향후 `6.x` 마이너 업데이트가 자동 포함될 수 있다. 다만 native addon 특성상 major 버전 핀이 더 안전하다. 플랜 파일에도 "`7.x`는 node≥26 요구" 라는 이유로 `6.x` 를 명시 선택한 근거가 기록돼 있어, 차기 `7.x` 자동 업그레이드 방지가 필요한 경우 `~6.1.2` 또는 `6.1.2` 정확 핀 고려.
- **제안**: 현재 lockfile 고정으로 재현성은 확보됨. 만약 `node>=26` 승급 전 `7.x` 설치를 막으려면 `"isolated-vm": "~6.1.2"` 또는 `"^6.1.x"` 조건 명시 고려 (LOW 우선순위).

---

### **[INFO]** 라이선스 — ISC
- **위치**: `package-lock.json` — `"license": "ISC"`
- **상세**: `isolated-vm@6.1.2` 의 라이선스는 ISC. 프로젝트 `package.json` 의 `"license": "UNLICENSED"` (사설 패키지)와 호환된다. ISC는 MIT 계열 permissive 라이선스로 상업적 사용 및 사설 프로젝트에 제약이 없다.
- **제안**: 없음.

---

### **[INFO]** 취약점 — 알려진 CVE 없음 (지식 컷오프 기준)
- **위치**: `isolated-vm@6.1.2`
- **상세**: 2025년 8월 지식 컷오프 기준으로 `isolated-vm@6.1.2` 에 대한 공개된 CVE 또는 npm audit 경고가 확인되지 않는다. 해당 패키지는 V8 엔진 내부를 직접 다루므로 Node.js/V8 업그레이드 시 호환성 및 잠재 취약점 변화에 주의가 필요하다. CI 파이프라인에 `npm audit` 실행이 포함되어 있는지 확인 권장.
- **제안**: 정기 `npm audit` 또는 Dependabot 설정으로 native addon 의존성 취약점 모니터링 유지.

---

### **[INFO]** 불필요한 의존성 검토 — 표준 라이브러리 대체 불가
- **위치**: `code.handler.ts` 전체
- **상세**: `node:vm` 은 prototype-chain escape 를 막지 못하므로 표준 라이브러리로는 요구사항(구조적 host 격리)을 충족할 수 없다. `worker_threads` (플랜 옵션 B) 역시 동일 주소공간 공유로 격리 강도 미개선. 기존 의존성 중 대체 가능한 패키지도 없다. 신규 의존성 추가가 정당하다.
- **제안**: 없음.

---

### **[WARNING]** 의존성 크기 — 네이티브 addon 빌드 영향
- **위치**: `package-lock.json` — `"hasInstallScript": true`, `"dependencies": { "node-gyp-build": "^4.8.4" }`
- **상세**: `isolated-vm` 은 네이티브 C++ addon(node-gyp) 이다. `hasInstallScript: true` 는 `npm install` 시 빌드 스크립트가 실행됨을 의미한다. 다음 영향이 있다:
  1. **CI 이미지 빌드 시간**: `npm install` 에서 C++ 소스 컴파일이 추가됨. glibc prebuilt 바이너리 가 없으면 alpine/musl 환경에서 from-source 컴파일 발생 — 플랜에서 실증 통과 확인됨.
  2. **Docker 이미지 크기**: 컴파일 도구(`python3 make g++`)는 기존 `deps` 스테이지에 이미 있어 추가 레이어 증가는 최소화됨.
  3. **배포 시점 컴파일 없음**: CI에서 빌드된 이미지를 배포하므로 배포 시점 영향은 0.
  4. **per-exec dayjs 컴파일 오버헤드**: 코드 실행마다 `readFileSync` 로 읽은 dayjs UMD를 isolate 내 컴파일하므로 초회 지연이 있다. 플랜에 "후속 snapshot 최적화 여지" 로 명시되어 있으나 현재 성능 측정 기준치가 없다.
- **제안**: CI 파이프라인에서 alpine 환경 `npm install` 소요 시간을 측정하여 기준치 기록 권장. dayjs UMD 재컴파일 비용이 SLA 임계값에 근접하면 Isolate snapshot API 도입을 후속 작업으로 계획.

---

### **[INFO]** 호환성 — Node.js 버전 요건 충족
- **위치**: `package-lock.json` — `"engines": { "node": ">=22.0.0" }`
- **상세**: `isolated-vm@6.1.2` 의 engines 요건은 `node>=22`. 플랜에 따르면 Dockerfile 은 `node:24-alpine`, 로컬 환경은 `node v22.14` — 양쪽 모두 요건 충족. `7.x` 는 `node>=26` 요구로 현재 제외 결정됨.
- **제안**: `engines` 필드를 `package.json` 에 명시(`"engines": { "node": ">=22.0.0" }`)하면 하위 Node 버전으로 install 시도 시 명시적 경고가 뜬다. 현재 미명시 상태로 추가 고려 가능.

---

### **[INFO]** 기존 의존성 `dayjs` 사용 방식 변화
- **위치**: `code.handler.ts` — `import dayjs from 'dayjs'` 제거, `readFileSync(require.resolve('dayjs/dayjs.min.js'))` 로 대체
- **상세**: `dayjs` 는 여전히 `package.json` 에 남아 있으며(다른 코드에서 사용 가능), code.handler 에서의 사용 방식이 host 직접 import → isolate 내 UMD 실행으로 변경됐다. `require.resolve('dayjs/dayjs.min.js')` 는 CommonJS 런타임 및 ts-jest 양쪽에서 동작함을 플랜이 명시. 단, `dayjs/dayjs.min.js` 가 `dayjs` 패키지의 공식 exports 필드에 포함되어 있는지 확인이 필요하다 — 미포함 시 향후 dayjs major 버전에서 경로 변경 가능성이 있다.
- **제안**: `dayjs` 패키지의 `package.json` 의 `exports` 필드 또는 공식 UMD 번들 경로를 한 번 확인하여 `dayjs.min.js` 경로의 안정성 검증 권장. 경로가 공식 exports에 없다면 `__mjs` 또는 `dist/dayjs.min.js` 와 같은 공식 alias 사용 고려.

---

### **[INFO]** 내부 의존성 — 프로젝트 모듈 간 관계 변화 없음
- **위치**: `code.handler.ts` imports
- **상세**: 내부 패키지(`@workflow/*`) 임포트 구조 변화 없음. `node-handler.interface.js`, `metadata-validation.js`, `code.schema.js` 등 내부 모듈 의존 관계도 동일하게 유지된다.
- **제안**: 없음.

---

## 요약

이번 변경의 핵심 의존성 추가는 `isolated-vm@6.1.2` 하나이며, ISC 라이선스로 호환되고 spec 로드맵과 사용자 결정으로 충분히 정당화된 보안 필수 의존성이다. 버전은 lockfile 로 고정되어 재현성이 보장된다. 주요 리스크는 네이티브 addon 특성에서 오는 빌드 시간 증가와 per-exec dayjs isolate 컴파일 오버헤드로, 전자는 플랜에서 alpine 환경 실증 통과가 확인됐고 후자는 후속 snapshot 최적화 여지로 명기되어 있다. `^6.1.2` 의 caret 범위가 향후 `7.x`(node>=26 요구)를 포함하지 않음은 npm semver 상 보장되며, lockfile 고정으로 실질적 위험도 낮다. `dayjs/dayjs.min.js` 경로의 공식 exports 포함 여부를 한 번 확인하는 것이 유일한 선제 점검 권고사항이다.

---

## 위험도

LOW
