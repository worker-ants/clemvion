# Dependency Review

## 발견사항

- **[INFO]** 신규 외부 의존성 없음 — `package.json` 변경 0건
  - 위치: 전체 diff (`git diff --stat` 로 확인, `package.json`/`pnpm-lock.yaml` 등 매니페스트 파일 미포함)
  - 상세: 이번 변경은 `@nestjs/swagger`(`ApiBody`, `ApiPropertyOptional`, `ApiProperty`, `ApiConsumes`), `@nestjs/common`, `reflect-metadata` 등 **이미 backend `package.json` 에 선언된 기존 의존성**만 재사용한다. 새 npm 패키지를 추가하지 않았으므로 라이선스·신규 CVE·번들 크기 항목은 해당 없음.
  - 제안: 없음(조치 불필요).

- **[INFO]** 신규 테스트 헬퍼가 `@nestjs/common` 의 비공개 서브패스를 딥임포트 — 기존 의존성에 대한 결합도가 늘었다
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:9-10`(import), `:145-171`(`bodyParamDesignType` 함수) — 게이트 기준 `import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';` / `import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';`
  - 상세: 실측 확인 — `require('@nestjs/common')` 메인 엔트리에는 `ROUTE_ARGS_METADATA`, `RouteParamtypes` 둘 다 export 되어 있지 않다(`false false`). 즉 이 두 심볼은 `@nestjs/common` 의 **공개 API 표면이 아닌 서브패스**(`/constants`, `/enums/route-paramtypes.enum`)로만 접근 가능하다. backend `package.json` 은 `"@nestjs/common": "^11.0.1"` 로 **caret 고정**(메이저 미변경이면 자동 업데이트 허용)인데, 서브패스·내부 상수는 semver 공개 계약 대상이 아니므로 **마이너/패치 업그레이드만으로도** 이 경로가 이름·형태를 바꿔 깨질 수 있다(실제로 설치된 `11.1.27` 에서는 정상 동작함을 `node -e` 로 확인했다 — 현재는 문제 없음). 선례 `workflows-execute-body.spec.ts` 는 `design:paramtypes` reflection 만 썼고 이런 서브패스 딥임포트가 없었다 — 이번 PR 이 그 표면을 처음 늘린 것이다.
  - 참고: 이 코드 자체에 이미 자기인식 주석이 있다 — "`ROUTE_ARGS_METADATA` · `RouteParamtypes` 는 `@nestjs/common` 의 공개 진입점이 아닌 내부 경로다. Nest 메이저 업그레이드로 키 형식이 바뀌면 이 헬퍼의 에러 경로 테스트가 먼저 깨진다"(swagger-probe.ts 138-140행 부근 JSDoc). 다만 그 주석은 "메이저 업그레이드" 만 언급하는데, 실제 리스크는 **caret 고정 하에서는 마이너/패치로도** 발생할 수 있다는 점이 조금 더 넓다. 테스트 전용 코드이고, 세 모듈의 캐너리가 이 헬퍼 하나에 공유·집중돼 있어 깨지면 즉시 눈에 띄는 방식으로 실패한다(원인 불명 산발 실패가 아님) — 차단 사유는 아니다.
  - 제안: 조치 불요(INFO). 후속으로 헬퍼 JSDoc 의 "메이저 업그레이드" 문구를 "마이너/패치 포함, `@nestjs/common` 업그레이드 시" 로 넓혀 적으면 다음 사람이 범위를 정확히 안다.

- **[INFO]** 내부 모듈 의존 관계 — 신규 DTO 배치·공용 헬퍼 재사용 모두 적절
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts`, `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts`, `codebase/backend/src/shared/testing/swagger-probe.ts`
  - 상세: 새 요청 DTO 둘은 각자의 도메인 모듈(`triggers/dto`, `executions/dto`) 안에 위치해 기존 응답 DTO(`dto/responses/*`)와 나란한 구조를 따른다. 순환 의존(controller → dto → controller) 없음. 신규 헬퍼 `bodyParamDesignType` 은 `shared/testing/swagger-probe.ts` 에 추가돼 3개 모듈(`triggers`, `executions`, `hooks`)의 신규 spec 이 중복 없이 재사용한다 — 개별 spec 마다 반사(reflection) 로직을 복제하지 않은 점은 내부 의존 설계로서 바람직하다.
  - 제안: 조치 불요.

## 요약

이번 변경은 3개 라우트(`rotate-bot-token`, `executions/:id/continue`, `hooks/:endpointPath`)에 `@ApiBody`/`@ApiPropertyOptional`/`@ApiProperty` OpenAPI 데코레이터만 추가하는 순수 문서화 작업으로, `package.json` 등 의존성 매니페스트는 전혀 건드리지 않았다(신규 패키지·버전 변경·라이선스·취약점 항목 모두 해당 없음). 유일하게 짚을 점은 신규 공용 테스트 헬퍼 `bodyParamDesignType` 이 `@nestjs/common` 의 비공개 서브패스(`ROUTE_ARGS_METADATA`, `RouteParamtypes`)를 딥임포트해 기존 의존성에 대한 내부 API 결합도를 늘렸다는 것인데, 테스트 전용 코드이고 현재 설치 버전에서 정상 동작이 확인되며 이미 코드 자체에 리스크 인지 주석이 있어 차단 사유는 아니다. 나머지 신규 파일(DTO·spec)은 기존 의존성만 사용하고 내부 모듈 배치도 기존 패턴을 따른다.

## 위험도

NONE
