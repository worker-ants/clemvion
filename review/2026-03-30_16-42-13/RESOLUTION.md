# 코드 리뷰 이슈 조치 내용

## W1 (Security) - getMemberRole null → owner 폴백의 권한 상승 위험
**조치**: `jwt.strategy.ts`에서 `getMemberRole` null 반환 시 기본값을 `'owner'`에서 `'member'`로 변경하여 최소 권한 원칙(PoLP)을 적용.
**테스트**: `jwt.strategy.spec.ts`에서 기대값을 `'member'`로 수정 확인.

## W2 (Architecture) - uuid-transform.spec.ts 레이어 역전
**조치**: `common/dto/uuid-transform.spec.ts`를 삭제하고, 각 도메인 모듈 하위로 테스트를 분리:
- `modules/workflows/dto/workflow-dto-validation.spec.ts`
- `modules/nodes/dto/node-dto-validation.spec.ts`
- `modules/triggers/dto/trigger-dto-validation.spec.ts`

## W3 (Architecture) - JwtStrategy SRP 위반
**보류**: JwtStrategy가 workspace 조회까지 담당하는 구조는 Phase 1 설계 의도에 따른 것. Phase 2에서 Guard/Interceptor 분리 검토.

## W4 (Requirement) - DTO별 validate 테스트 누락
**조치**: `CreateWorkflowDto`, `UpdateWorkflowDto`, `CreateNodeDto`, `UpdateNodeDto`, `CreateTriggerDto`, `UpdateTriggerDto` 각각에 대해 `validate()` 기반 테스트 추가. 빈 문자열 → null 변환 후 validation 통과, 잘못된 문자열 validation 실패 케이스 포함.

## W5 (Testing) - 호출 인자 검증 누락
**조치**: `jwt.strategy.spec.ts`에서 `findById`, `findPersonalWorkspace`, `getMemberRole` 호출 인자를 `toHaveBeenCalledWith`로 검증 추가.

## W6 (Testing) - getMemberRole 예외 전파 미검증
**조치**: `getMemberRole.mockRejectedValue` 케이스 추가하여 에러 전파 확인.

## W7 (Requirement) - user: null 케이스 미검증
**조치**: `workspace.decorator.spec.ts`에 `createMockContext({}, null)` 테스트 케이스 추가.

## W8 (API Contract) - 잘못된 형식 헤더 값 검증
**보류**: 현재 WorkspaceId 데코레이터는 존재 여부만 확인. UUID 형식 검증은 데코레이터의 책임이 아닌 서비스 계층에서 처리. 추후 Guard에서 검증 추가 검토.

## W9 (Testing) - null 직접 입력 케이스 미검증
**조치**: `workflow-dto-validation.spec.ts`에 `folderId: null` 직접 전달 시 null 유지 테스트 추가. `trigger-dto-validation.spec.ts`에 `authConfigId: null` 테스트 추가.

## W10 (Maintainability) - 상수 중복
**조치**: 모든 테스트 파일에서 `VALID_UUID`, `VALIDATE_OPTIONS` 상수를 추출하여 중복 제거. `jwt.strategy.spec.ts`에서 `validPayload` 상수 추출.

## INFO 항목
- `beforeEach` → `beforeAll` 전환: `jwt.strategy.spec.ts`에 적용 완료.
- `workspace.decorator.spec.ts`에 `getParamDecoratorFactory` 함수 주석 추가.
