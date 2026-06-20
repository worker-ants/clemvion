# 변경 범위(Scope) 리뷰

## 발견사항

모든 변경은 "npm → pnpm workspace 모노레포 전환"이라는 단일 목적에 귀속된다. 파일별로 범위 이탈 여부를 점검한다.

### [INFO] `@nestjs/swagger` 버전 핀 추가 — 의존성 마이그레이션 범위 경계
- 위치: `/package.json` (루트) — `"@nestjs/swagger": "11.2.7"` (pnpm overrides)
- 상세: swagger 핀은 엄밀히 말해 pnpm 전환 자체의 필수 요소가 아니라 deep-import 호환성 보존을 위한 별도 핀이다. 커밋 메시지에 "deep-import 정리는 별도 PR" 이라고 명시되어 있어 의도적 결정임은 확인된다. pnpm overrides 로만 관리되므로 실용적으로 묶인 처리이나, 기술적으로는 마이그레이션 범위 외 의존성 고정에 해당한다.
- 제안: 현 PR 에 묶는 것이 편의상 합리적이나, 후속 deep-import 정리 PR 이 완료되면 이 핀을 제거해야 한다는 TODO 주석이 이미 충분히 달려 있어 수용 가능 수준.

### [INFO] `docker-compose.e2e.yml` playwright-runner 볼륨 구조 변경 — 범위 내이나 복잡도 증가
- 위치: `docker-compose.e2e.yml` 라인 213–254 구간
- 상세: pnpm workspace 전환으로 frontend 단독 설치가 불가능해져 playwright-runner 가 레포 루트 전체를 mount(`./:/app`)해야 한다. 이에 따라 anon volume 목록이 `/app/node_modules`, `/app/codebase/frontend/node_modules`, 각 내부 패키지 node_modules 등 5개로 늘었다. 이는 pnpm hoisted 레이아웃의 필연적 결과이므로 범위 이탈은 아니다. 단, 루트 전체 mount 는 워크트리 환경에서 `.git`·`.claude` 등 민감 디렉토리가 컨테이너에 노출되는 면이 있으므로 별도 검토 가치가 있다.
- 제안: 현재로서는 INFO 수준. 루트 전체 mount 보안 리스크는 별도 보안 리뷰 또는 후속 이슈로 추적 권장.

### [INFO] `plan/in-progress/cafe24-backlog-residual.md`, `spec/conventions/cafe24-api-catalog/_overview.md`, `spec/conventions/cafe24-restricted-scopes.md`, `spec/conventions/makeshop-api-catalog/_overview.md` — npm 명령어 참조 수정
- 위치: 위 4개 파일의 `npm test --workspace backend -- catalog-sync` → `pnpm --filter backend test -- catalog-sync`
- 상세: spec/plan 문서의 명령어 예시를 pnpm 으로 교체한 것이다. CLAUDE.md 규약상 developer 는 `spec/` 에 쓰기 권한이 없으나, 이는 실행 명령어 참조의 사실적 갱신이므로 pm 마이그레이션의 필수 문서 동기화로 볼 수 있다. 범위 이탈보다는 관리 체계 규약 준수 여부 문제에 해당한다.
- 제안: 내용 자체는 마이그레이션에 필요한 정확한 갱신이다. 다만 CLAUDE.md 규약("spec/ 변경 → project-planner")과 충돌 여지가 있으므로 팀 내 확인 권장. 기능적 위험은 없다.

## 요약

이 PR 은 npm → pnpm workspace 전환이라는 명확한 단일 목적을 가지며, 33개 파일에 걸친 모든 변경이 해당 목적에 직접 귀속된다. scaffold 파일(루트 `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.nvmrc`)신설, 8개 `package-lock.json` 삭제, 각 `package.json` 의 `file:` → `workspace:*` 전환, Dockerfile·CI workflow·docker-compose·테스트 하니스·문서의 npm 명령어 교체까지 모두 마이그레이션의 필요 변경이다. `@nestjs/swagger` 버전 핀과 spec 문서 명령어 참조 수정이 엄격한 의미에서 범위 경계에 걸리지만, 둘 다 전환의 실용적 필수 동반 조치이며 커밋 메시지에 근거가 명시되어 있다. 의미 없는 포맷팅 변경, 불필요한 리팩토링, 관련 없는 코드 영역 수정은 발견되지 않았다.

## 위험도

LOW
