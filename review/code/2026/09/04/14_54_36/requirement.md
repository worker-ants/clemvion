# 요구사항(Requirement) 리뷰 — 응답 DTO 83곳 `required:false → true` 전환

## 검토 방법

- `spec/5-system/2-api-convention.md` §5.4 (176~198행) 를 직접 열어 규약 문면과 diff 를 line-level 로 대조.
- `git show --stat HEAD` 로 실제 커밋 범위(22 파일, CHANGELOG + 20 응답 DTO + plan) 를 확인.
- 저장소 **밖** scratch 디렉터리 결과 파일에 `cd codebase/backend && npx tsc --noEmit -p tsconfig.json` 실행(저장소 파일은 전혀 수정하지 않음, 순수 read-only 컴파일). 결과를 커밋 메시지가 주장하는 "타입체크 ratchet baseline 일치 (197/36)" 과 대조.
- `grep`/`perl` 로 `dto/responses/**/*.ts` 전수를 훑어 `@ApiPropertyOptional({...nullable:true...}) field?: T | null` 패턴 잔존 여부(누락 여부) 확인.
- `git status --short` 로 저장소가 깨끗한 상태임을 확인(뮤테이션 없음).

## 발견사항

- **[INFO]** tsc 직접 실행 결과가 커밋의 정량 주장과 정확히 일치함을 실측 확인
  - 위치: `codebase/backend/tsconfig.json` (프로젝트 전체), 커밋 `499675277`
  - 상세: `npx tsc --noEmit -p tsconfig.json` 를 그대로 실행한 결과 오류 **197건, 36개 파일** — 커밋 메시지의 "타입체크 ratchet baseline 일치 (197/36)" 과 정확히 일치했다. 오류는 전부 `*.spec.ts` 목(mock) 관련(예: `Mock<any,any,any>` 형 불일치, 관련 없는 서비스 스펙)이며, 이번 diff 가 건드린 20개 응답 DTO 파일이나 그 조립부(assembler) 는 단 한 건도 관련되지 않았다. 즉 "83필드 뒤집고 비-spec 오류 0건" 주장이 근거 있는 실측이었다(재현으로 검증).
  - 제안: 없음 — 증빙 확인 목적의 INFO.

- **[INFO]** 83건 필드 전환 + 12개 파일 import 정리 수치가 diff 실제 카운트와 일치
  - 위치: 20개 `dto/responses/*.ts` 파일 diff 전체
  - 상세: `git show HEAD` 에서 `^-  @ApiPropertyOptional`/`^+  @ApiProperty(` 발생 횟수를 세면 각각 83건, `^-import { ApiProperty, ApiPropertyOptional }` (단일 사용처 정리) 발생은 12건 — CHANGELOG·커밋 메시지의 "83곳"·"12파일" 주장과 정확히 일치한다.
  - 제안: 없음.

- **[INFO]** 배치 완결성 확인 — `dto/responses/**` 전수 스캔에 `@ApiPropertyOptional({...nullable:true...}) field?: T | null` 패턴 잔존 0건
  - 위치: `codebase/backend/src/modules/**/dto/responses/*.ts` (전수)
  - 상세: multi-line 디코레이터까지 잡는 `perl -0777` 정규식으로 모든 응답 DTO 파일을 훑었으나 낡은 패턴이 하나도 남지 않았다. §5.4 예외로 문서화된 키-생략 필드(`conversationThread?: ConversationThread` in `WaitingContextBaseDto`, `TriggerDto.cronExpression?`/`timezone?`, `WorkspaceSettingsDto.timezone?`/`maxConcurrentExecutions?` 등)는 diff 에서 의도적으로 손대지 않았고 현재도 `@ApiPropertyOptional` + `?:` 그대로다 — §5.4 (a)/(b) 예외를 정확히 보존했다.
  - 제안: 없음.

- **[INFO]** `WorkflowVersionListItemDto.creator`/`WorkflowVersionDto.creator` "always-present" 전제 실측 확인
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:44-49,81-86`, 근거 `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:51-65,70-74`
  - 상세: 필드 주석 "작성자 정보 (조인 시 포함)" 이 "조건부 포함"으로 오독될 여지가 있으나, 서비스 조회부는 `relations: { creator: true }` (list) / `relations: ['creator']` (detail) 로 **항상** LEFT JOIN 하므로 creator 는 항상 키 존재(참조 유저 삭제 시 `null`, 그 외엔 객체) — `null`(키 present) 의미론과 정확히 일치한다. 주석 문구는 이 diff 가 건드리지 않은 기존 텍스트이며 실제 동작과는 무모순이라 액션 불필요.
  - 제안: 없음(정보성).

## 요약

본 변경은 응답 DTO 83개 필드를 `@ApiPropertyOptional({nullable:true}) field?: T | null` → `@ApiProperty({nullable:true}) field: T | null` 로 전환하는 순수 OpenAPI 메타데이터 정정이며, `spec/5-system/2-api-convention.md` §5.4(176~198행, 특히 188-196행 "DTO 선언이 wire 를 반영해야 한다")와 line-level 로 정확히 일치한다. §5.4 가 명시한 응답-바디 전용 적용 범위, 요청 DTO(PATCH tri-state) 제외, 키-생략 예외((a)/(b)) 필드 보존까지 모두 diff 에 정확히 반영됐다. "필드가 상시 존재인지" 판정을 손이 아니라 `tsc` 컴파일 결과로 검증했다는 커밋의 핵심 주장을 이 리뷰가 독립적으로 재실행해 확인했으며(오류 197/36 — 정확히 일치, DTO 관련 오류 0건), 전환 대상 83건·import 정리 12건 수치도 diff 실카운트와 정확히 일치했다. `dto/responses/**` 전수 스캔으로 누락된 대상이 없음도 확인했다. TODO/FIXME 류 미완성 표식은 없고, 런타임 동작 변경이 없다는 CHANGELOG/커밋의 서술도 디코레이터·타입 선언만 바뀐 diff 내용과 부합한다. Critical/Warning 급 발견사항은 없다.

## 위험도

LOW
