### 발견사항

검토 대상 4개 파일은 모두 **테스트 인프라 문서화/가드 추가**(PROJECT.md 컨벤션 명문화, e2e 단위 가드 신규 파일, 테스트 스펙 내 변수명 정정, plan 상태 갱신) 성격이며, 프로덕션 런타임 코드(인증/인가, DB 접근, 외부 입력 처리, 암호화 등)에 대한 변경은 포함되어 있지 않습니다.

- **[INFO]** 신규 가드 테스트(`e2e-no-sub-global-timeout.test.ts`)는 리포지토리 내부 고정 경로(`__dirname` 기준 상대경로)만 `fs.readFileSync`/`readdirSync`로 읽으며, 외부/사용자 입력을 받지 않습니다.
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts`
  - 상세: 경로 탐색(path traversal)이나 인젝션 벡터가 될 신뢰 경계 넘는 입력이 없음 (CI/빌드 타임에만 실행되는 self-referential 검사). `playwright.config.ts` 파싱 실패 시 던지는 에러 메시지도 내부 개발자용 안내 문구일 뿐 민감정보(자격증명·경로·스택트레이스 등) 노출 없음.
  - 제안: 조치 불필요. 다만 향후 이 가드가 외부 입력(예: PR로 전달되는 다른 리포 파일)을 스캔하도록 확장될 경우 심볼릭 링크/경로 escape 방지를 재검토 권장.

- **[INFO]** `execution-engine.service.spec.ts`의 변경은 로컬 변수명 `service` → `svcMetrics` 리네임 1줄뿐이며, mock 객체를 통한 private 메서드 접근 패턴(`as unknown as {...}`) 자체는 기존과 동일합니다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:17005` 부근
  - 상세: 테스트 전용 코드로 프로덕션 인가/검증 로직 변경 없음. 보안 영향 없음.

- **[INFO]** `PROJECT.md`/`plan/in-progress/e2e-retry-visibility-followup.md`는 순수 문서(컨벤션 서술, 작업 상태 표기) 변경으로 시크릿·자격증명·민감정보 포함 없음.

### 요약
이번 변경 셋은 e2e 테스트 안정화를 위한 "sub-global timeout override 금지" 컨벤션을 문서화하고 이를 강제하는 CI 단위 가드를 신설하는 순수 개발 프로세스/테스트 인프라 작업으로, 인증·인가·데이터 처리·외부 입출력 경로에 어떠한 변경도 가하지 않습니다. 신규 가드 코드는 신뢰된 리포지토리 내부 경로만 읽어 정규식으로 파싱하며 외부 입력·시크릿·네트워크 호출이 전혀 없어 인젝션·정보노출·인증우회 등 어떤 카테고리에서도 취약점이 발견되지 않았습니다.

### 위험도
NONE