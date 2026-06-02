# 의존성(Dependency) 리뷰 결과

## 발견사항

### [INFO] brace-expansion 다중 버전 패치 업그레이드 (v1/v2/v5 계열)
- 위치: `node_modules/brace-expansion` 및 하위 중복 설치 항목 8곳
- 상세: 세 개 계열에 걸쳐 패치/마이너 버전 업그레이드. `1.1.13 → 1.1.15`, `2.0.3 → 2.1.1`, `5.0.5 → 5.0.6`. npm audit 보안 수정(ReDoS 취약점 패치)에 해당. 모두 MIT 라이선스 유지. 하위 호환성 있는 범위이며 소비 패키지의 semver 요건을 만족함.
- 제안: 문제 없음. npm audit 수정 목적에 부합하는 적절한 조치.

### [INFO] ws 8.18.3 → 8.20.1 업그레이드 (engine.io, socket.io-adapter 경유)
- 위치: `node_modules/ws`, `node_modules/engine.io` (6.6.6→6.6.8), `node_modules/socket.io-adapter` (2.5.6→2.5.7)
- 상세: `ws` 패치/마이너 업그레이드. ws 8.x 계열에는 DoS 취약점(CVE-2024-37890 계열) 수정 이력이 있으며 8.20.x로의 업그레이드는 알려진 취약점 제거 목적에 부합. MIT 라이선스 유지. engine.io와 socket.io-adapter도 ws 의존 범위를 `~8.20.1`로 상향하여 함께 업그레이드됨.
- 제안: 적절한 보안 업그레이드. 변경 없이 수용 권장.

### [INFO] qs 6.15.0 → 6.15.2 패치 업그레이드
- 위치: `node_modules/qs`
- 상세: BSD-3-Clause 라이선스 유지. 패치 업그레이드이며 npm audit 수정 목적과 일치.
- 제안: 문제 없음.

### [INFO] liquidjs 10.25.7 → 10.27.0 마이너 업그레이드
- 위치: `node_modules/liquidjs`
- 상세: MIT 라이선스 유지. optional 패키지. 마이너 버전 2단계 상승이나 optional로 표시되어 있어 런타임 필수 경로가 아님. semver 마이너 변경이므로 기능 추가 가능성이 있으나 breaking change 위험 낮음.
- 제안: optional 패키지 마이너 업그레이드는 특이사항 없음. 이메일 템플릿 렌더링 등 사용 경로가 있다면 회귀 테스트 권장.

### [INFO] chokidar, readdirp devOptional 플래그 변경 (`"dev": true` → `"devOptional": true`)
- 위치: `node_modules/chokidar` (4.0.3), `node_modules/readdirp` (4.1.2)
- 상세: 의존성 제거가 아닌 플래그 변경. `devOptional`은 dev+optional 복합 속성으로 프로덕션 설치 시 설치되지 않는다는 의미는 `dev: true`와 동일. 기능적 변화 없음.
- 제안: 문제 없음.

### [INFO] @nestjs-modules/mailer 내부 chokidar/glob-parent/readdirp 중복 엔트리 제거
- 위치: `node_modules/@nestjs-modules/mailer/node_modules/` 하위 chokidar 3.6.0, glob-parent 5.1.2, readdirp 3.6.0 제거
- 상세: 이전에 mailer 패키지 하위에 별도 설치되어 있던 구버전 중복 엔트리가 제거됨. 상위 트리의 최신 버전으로 통합된 결과. 의존성 중복 제거는 번들 크기와 잠금 파일 복잡도 감소에 긍정적. chokidar 3.x와 4.x 간 API 차이가 있으나 모두 peer/optional로 표시되어 있어 직접적 런타임 영향은 낮음.
- 제안: 긍정적 변화. 단, mailer 패키지가 chokidar 3.x 특유의 API를 사용하는 경우 런타임 오류 가능성이 있으므로 mailer 기능 통합 테스트 권장.

### [INFO] preview-email/node_modules/uuid 9.0.1 엔트리 제거
- 위치: `node_modules/preview-email/node_modules/uuid` (9.0.1 삭제)
- 상세: preview-email 패키지 하위의 uuid 9.0.1 중복 엔트리 제거. 상위 트리의 uuid 버전(프로젝트 루트 `uuid ^13.0.2`)으로 통합. preview-email은 optional 패키지이므로 런타임 필수 경로 아님.
- 제안: 문제 없음.

### [INFO] typeorm/node_modules/uuid 11.1.1 엔트리 제거
- 위치: `node_modules/typeorm/node_modules/uuid` (11.1.1 삭제)
- 상세: typeorm 하위의 uuid 11.1.1 중복 엔트리가 제거되어 루트 uuid 13.x로 통합됨. uuid는 v7 이후 named export 구조가 변경되었으며, typeorm이 uuid를 호출하는 방식에 따라 호환성 파단 가능성이 있음. 단 typeorm 최신 버전(0.3.x)은 uuid를 내부 UUIDv4 생성에 사용하며 v10+ 에서 API 호환성이 유지됨.
- 제안: 낮은 위험. typeorm 0.3.x와 uuid 13.x 호환성 확인 권장. 실제 엔티티 UUID 생성 흐름 회귀 테스트 실행.

### [INFO] uglify-js 3.19.3 `"dev": true` 플래그 제거
- 위치: `node_modules/uglify-js`
- 상세: `"dev": true`가 제거되어 optional 패키지로만 분류 변경. uglify-js는 mjml 등의 선택적 의존성이므로 실제 런타임에는 설치 여부가 opt-in. 기능 변화 없음.
- 제안: 특이사항 없음.

## 요약

이번 변경은 신규 의존성 추가 없이 기존 의존성의 보안 패치 업그레이드와 중복 엔트리 정리에 집중되어 있다. 주요 내용은 `brace-expansion`(다중 계열), `ws`, `engine.io`, `socket.io-adapter`, `qs`의 보안 취약점 수정 패치 업그레이드이며 모두 기존 MIT/BSD 라이선스를 유지한다. 추가로 `@nestjs-modules/mailer`, `preview-email`, `typeorm` 하위의 중복 설치 패키지(chokidar, glob-parent, readdirp, uuid)가 제거되어 잠금 파일이 정리되었다. `typeorm/node_modules/uuid` 통합으로 인해 typeorm이 루트 uuid 13.x와 런타임 호환되는지 낮은 위험도로 확인이 권장되나, 전반적으로 npm audit 수정 목적에 충실한 안전한 의존성 변경이다.

## 위험도

LOW
