import { buildSwaggerDocument } from '../../shared/testing/swagger-probe';
import { WorkflowAssistantController } from './workflow-assistant.controller';
import { WorkflowAssistantSessionService } from './workflow-assistant-session.service';
import { WorkflowAssistantStreamService } from './workflow-assistant-stream.service';

/**
 * `swagger.md §2-4` — *"보호된 엔드포인트는 기본적으로
 * `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })` 를 포함합니다."*
 *
 * ## 왜 이 파일이 있나
 *
 * 이 컨트롤러는 전 라우트가 `@ApiBearerAuth` 뒤에 있는데도 401 을 **한 건도** 문서화하지
 * 않고 있었다(`spec-sync-stop-editor-and-forbidden-routes.md`). 규약을 지키는 컨트롤러가
 * 40개가 넘는데 이 하나만 빠져 있었다는 것은, **아무 게이트도 이 축을 보고 있지 않다**는
 * 뜻이다 — 고쳐 놓아도 다음 라우트가 추가될 때 같은 방식으로 다시 빠진다.
 *
 * 저장소 전체를 강제하는 가드는 여기 범위가 아니다(`@Public` 전용 컨트롤러 셋이 정당한
 * 예외라 판정 규칙이 따로 필요하다). 이 스펙은 **이 컨트롤러**에 한해 회귀를 잠근다.
 */
describe('WorkflowAssistantController — OpenAPI 401 문서화 (swagger.md §2-4)', () => {
  const EXPECTED_401_DESCRIPTION = '인증 실패 또는 토큰 만료';

  let operations: { id: string; responses: Record<string, unknown> }[];

  beforeAll(async () => {
    const doc = await buildSwaggerDocument({
      controllers: [WorkflowAssistantController],
      providers: [
        { provide: WorkflowAssistantSessionService, useValue: {} },
        { provide: WorkflowAssistantStreamService, useValue: {} },
      ],
    });

    operations = Object.entries(doc.paths).flatMap(([path, pathItem]) =>
      Object.entries(pathItem as Record<string, unknown>)
        .filter(([, op]) => typeof op === 'object' && op !== null)
        .map(([method, op]) => ({
          id: `${method.toUpperCase()} ${path}`,
          responses: ((op as { responses?: Record<string, unknown> })
            .responses ?? {}) as Record<string, unknown>,
        })),
    );
  });

  /**
   * **공허 방지.** 아래 `for…of` 단언은 `operations` 가 비면 0회 실행되고 통과한다.
   * 프로브가 컨트롤러를 못 세우거나 라우트가 사라지는 회귀를, 조용한 GREEN 이 아니라
   * 여기서 RED 로 만든다. 7 은 이 컨트롤러의 실제 라우트 수다.
   */
  it('[전제] 프로브가 라우트 7개를 모두 세운다', () => {
    expect(operations).toHaveLength(7);
    expect(operations.map((o) => o.id)).toEqual(
      expect.arrayContaining([
        'GET /workflow-assistant/sessions',
        'POST /workflow-assistant/sessions/{id}/messages',
      ]),
    );
  });

  it('전 라우트가 401 응답을 규약 문구로 문서화한다', () => {
    const missing = operations
      .filter((op) => op.responses['401'] === undefined)
      .map((op) => op.id);
    expect(missing).toEqual([]);

    for (const op of operations) {
      expect(
        (op.responses['401'] as { description?: string }).description,
      ).toBe(EXPECTED_401_DESCRIPTION);
    }
  });
});
