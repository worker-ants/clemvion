# 의존성(Dependency) 리뷰 결과

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 시스템 컨텍스트 prefix 기능 전체가 내부 헬퍼(`system-context-prefix.ts`)와 Node.js 표준 API(`Intl.DateTimeFormat`)만으로 구현됨
  - 위치: `codebase/backend/src/nodes/ai/shared/system-context-prefix.ts`
  - 상세: timezone 포맷, UTC 오프셋 계산, IANA 검증 모두 `Intl.DateTimeFormat` + 정규식만 사용. `dayjs`(기존 의존성)는 추가 사용하지 않음. 외부 라이브러리 0건 추가.
  - 제안: 현 구현 유지. `dayjs`의 timezone 플러그인을 쓰면 코드가 간결해지지만 번들 크기 트레이드오프가 있으므로 현 상태가 적절함.

- **[INFO]** `uglify-js` 의 `dev: true` 플래그 제거 (backend `package-lock.json`)
  - 위치: `codebase/backend/package-lock.json` 라인 18603 부근
  - 상세: `uglify-js@3.19.3`의 `"dev": true` 표기가 삭제됐다. 이는 잠금 파일이 재생성되면서 `optional: true` 패키지로 분류가 재조정된 결과다. 실제 `package.json`의 `dependencies`/`devDependencies` 구분은 변경되지 않았고 `optional: true`가 유지되므로 런타임 번들에 포함되지 않는다.
  - 제안: 영향 없음. 별도 조치 불필요.

- **[INFO]** `@nestjs-modules/mailer` 내부 중복 패키지 항목 제거 (backend `package-lock.json`)
  - 위치: `codebase/backend/package-lock.json` — `node_modules/@nestjs-modules/mailer/node_modules/{chokidar,glob-parent,readdirp}` 항목 삭제
  - 상세: 세 패키지(`chokidar@3.6.0`, `glob-parent@5.1.2`, `readdirp@3.6.0`) 모두 `optional: true, peer: true`로 표시된 항목이었으며, npm 중복 제거(deduplication) 또는 버전 트리 재정렬로 제거된 것이다. `@nestjs-modules/mailer` 는 이미 기존 의존성이고 이 세 패키지는 `chokidar`의 선택적 피어 의존성이다. 잠금 파일 내 상위 트리에서 호환 버전이 제공되므로 기능 누락 없음.
  - 제안: 영향 없음. 별도 조치 불필요.

- **[INFO]** `fsevents@2.3.2` 의 `dev: true` 플래그 제거 (frontend `package-lock.json`)
  - 위치: `codebase/frontend/package-lock.json` 라인 6855 부근
  - 상세: backend의 `uglify-js`와 동일한 패턴. `optional: true`는 유지. macOS 파일시스템 이벤트 네이티브 모듈로 프로덕션 번들 포함 여부는 빌더가 `optional` 태그로 제어하므로 실제 번들 크기 영향 없음.
  - 제안: 영향 없음. 별도 조치 불필요.

- **[INFO]** 내부 모듈 간 의존 관계 — 새 공유 헬퍼의 import 경로 일관성
  - 위치: `ai-agent.handler.ts`, `text-classifier.handler.ts`, `information-extractor.handler.ts` — 모두 `'../shared/system-context-prefix'` 로 import
  - 상세: 세 핸들러가 동일한 상대 경로로 신설 헬퍼를 참조한다. 경로 일관성 확인됨. `execution-engine.service.ts`는 `workflowRepository.findOne({ relations: ['workspace'] })`를 추가해 `Workspace` 엔티티에 대한 join 의존이 생겼다. 이는 기존 TypeORM 의존성 범위 내 변경이다.
  - 제안: 영향 없음.

- **[INFO]** `CAFE24_TIMEZONE_SUFFIX` 상수가 metadata `index.ts` 에 직접 선언됨
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/index.ts`
  - 상세: 공통 상수가 `shared/` 디렉토리가 아닌 metadata 영역에 선언되어 있다. 현재는 `cafe24-mcp-tool-provider.ts` 한 곳에서만 import하므로 문제가 없으나, 추후 다른 모듈이 같은 상수를 필요로 할 때 의존 방향이 복잡해질 수 있다.
  - 제안: 현 시점은 단일 소비자이므로 현 위치 유지가 합리적. 소비처가 2곳 이상이 되면 `shared/constants/cafe24.ts` 등으로 이동 검토.

## 요약

이번 변경은 외부 패키지를 단 한 건도 추가하지 않는다. AI 노드 시스템 컨텍스트 prefix 기능 전체가 Node.js 내장 `Intl.DateTimeFormat` API만으로 구현되어 번들 크기 및 빌드 시간 영향이 없다. `package-lock.json` 변경은 기존 패키지의 `dev: true` 플래그 재조정 및 `@nestjs-modules/mailer`의 피어 선택적 의존성 중복 제거로, 실제 설치 패키지 구성에는 변화가 없다. 내부 모듈 의존 관계는 세 AI 핸들러가 공통 헬퍼를 단일 경로로 참조하는 clean 구조이며, `execution-engine.service.ts`의 `workspace` 조인 추가도 기존 TypeORM 범위 내 변경이다. 전반적으로 의존성 관점의 위험 요소가 없다.

## 위험도

NONE
