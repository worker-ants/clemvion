import * as path from 'node:path';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import {
  SRC_ROOT,
  findPublicDtoConsumers,
  findReferenceBearingDtos,
  findRequestReferenceFields,
  findScopeChecksReachableFrom,
  findUncheckedConsumers,
  findUnboundSites,
  isRequestDtoPath,
} from './reference-scope-guard';

/**
 * **요청 본문의 참조 id 를 저장하는 다음 경로가 소속 검사를 빠뜨려도 아무도 알려 주지 않았다.**
 *
 * 스펙 CLE-PLAT-DATA 「참조의 소속」 표는 요청 본문이 가리키는 워크플로 · 폴더 · 노드 · 모델 설정 · 인증 설정이 같은
 * 워크스페이스(노드는 같은 워크플로)에 있는지 저장 전에 보라고 정한다. #1420 이 그 검사를 넣었고 복합 FK(V134~V147)가
 * 17개 참조를 DB 에서 한 번 더 막는다. 그래도 같은 스펙 Rationale 은 «컬럼에 저장되는 참조 id 에는 정적 가드가 없다» 고 적어
 * 두었다. 새 요청 필드나 새 저장 경로가 검사 호출을 빠뜨리면 FK 가 있는 17개는 500 으로, 나머지는 조용히 남의 행을 가리키게
 * 된다(CLE-T-V6W99V).
 *
 * ## 왜 «저장하는 경로가 검사를 부르는가» 를 직접 묻지 않나
 *
 * 저장은 대개 스프레드(`repository.create({ ...rest, workspaceId })`)나 `Object.assign` 으로 필드를 싣는다. 단일 파일 AST
 * 로는 스프레드가 어느 필드를 나르는지 따라갈 수 없어서, «이 필드를 엔티티에 넘기는 저장» 을 찾는 술어는 정답 자리를 거의
 * 못 잡는다. 형제 가드 `endpoint-path-conflict-wrap` 이 겪은 것과 같은 모양이다.
 *
 * ## 그래서 술어를 뒤집었다 — 세 가지를 센다
 *
 * 1. **모집단**: 요청 DTO(`dto/` 아래, 응답 DTO 제외)의 프로퍼티 중 이름이 `id` · `*Id` · `*Ids` 인 것을 전부 센다. 각각은
 *    아래 카탈로그에 «검사한다(자리 목록)» 나 «범위 밖이다(사유)» 로 올라 있어야 한다. 새 필드가 생기면 여기서 멈춘다.
 * 2. **자리 묶음**: «검사한다» 로 적힌 자리(`<파일>#<메서드>`)마다, 같은 클래스의 `this.<메서드>()` 호출을 따라가서 그 필드
 *    이름을 검사하는 호출(`assertReferenceInScope` 등, 목록은 `SCOPE_CHECK_CALLEES`)에 닿아야 한다. 검사 호출 한 줄을
 *    지우면 여기서 멈춘다.
 * 3. **공개 소비**: 검사 대상 필드를 나르는 DTO(직접 선언 · 프로퍼티 타입 · `PartialType` 상속)를 매개변수로 받는 공개
 *    서비스 메서드는 그 필드의 자리 목록에 있거나 `EXPECTED_NON_WRITING_CONSUMERS` 에 사유와 함께 있어야 한다. 같은 DTO 를
 *    받는 새 저장 메서드가 생기면 여기서 멈춘다.
 *
 * ## 이 가드가 보지 않는 것
 *
 * - **검사 함수 안쪽.** 검사를 부르는지만 본다. `where` 에 `workspaceId` 를 실었는지는 각 서비스 단위 테스트와
 *   `test/cross-workspace-references.e2e-spec.ts` 가 본다.
 * - **필드 이름 단위로만 묶는다.** `saveCanvas` 의 `containerId` 검사가 노드의 것인지 다른 것인지는 가리지 않는다.
 *   `findEntity(dto.x)` 처럼 첫 인자를 읽는 검사기는 이름이 같으면 같은 필드로 본다.
 * - **DTO 타입으로 받지 않는 저장.** `FoldersService.create(workspaceId, data: { parentId?… })` 처럼 매개변수 타입이 DTO 가
 *   아니면 3번에 안 잡힌다. 카탈로그에 적힌 자리는 2번이 계속 본다.
 * - **이름이 참조 모양이 아닌 참조**(`botTokenRef` 같은 문자열 참조)와 **노드 `config` JSONB 안의 참조**. 뒤의 것은 형제
 *   가드 `node-row-writers` 와 실행 시 해석 경로가 맡는다.
 *
 * ## 뮤턴트 기록 (2026-11-07)
 *
 * 프로덕션 코드를 한 군데씩 바꾸고 이 스위트를 돌려 각각 RED(29개 중 1개 실패)를 확인한 뒤 되돌렸다.
 *
 * | 바꾼 곳 | 깨진 단언 |
 * | --- | --- |
 * | `TriggersService.create` 의 `assertReferenceInScope(…, 'workflowId', …)` 삭제 | 2번 `CreateTriggerDto.workflowId` |
 * | `NodesService.create` 의 `this.assertPlacementInWorkflow(…)` 삭제 | 2번 `CreateNodeDto.containerId` · `toolOwnerId` |
 * | `KnowledgeBaseService.create` 의 `this.assertModelConfigRefsInWorkspace(…)` 삭제 | 2번 추출 · 재순위 모델 설정 3개 |
 * | `WorkflowsService.saveCanvas` 의 `this.validateCanvasReferences(dto)` 삭제 | 2번 `SaveCanvas*` 4개 |
 * | `WorkflowsService.syncNodes` 의 `this.assertNewNodeIdsUnused(…)` 삭제 | 2번 `SaveCanvasNodeDto.id` |
 * | `CreateWorkflowDto` 에 `templateRefId?: string` 추가 | 1번 모집단 |
 * | `WorkflowsService` 에 `duplicateFrom(workspaceId, dto: CreateWorkflowDto)` 저장 메서드 추가 | 3번 `CreateWorkflowDto.folderId` |
 */

/** 카탈로그 항목 — 검사하는 자리 목록이거나, 범위 밖인 사유다. */
type Classification =
  { readonly checkedAt: readonly string[] } | { readonly outOfScope: string };

const SNAPSHOT_REASON =
  '어시스턴트에 보내는 편집기 스냅샷이다. 저장하지 않고 편집 결과는 캔버스 저장(SaveCanvas*)이 검사한다';

/**
 * 요청 DTO 참조 필드 전수 카탈로그. 키는 `<DTO 클래스>.<필드>` 다.
 *
 * 새 필드를 «범위 밖» 으로 올리려면 사유가 셋 중 하나여야 한다. 저장하지 않는다(조회 필터 · 일회성 실행 입력), 외부 시스템의
 * id 다, 또는 다른 경로가 소속을 따로 본다(그 경로를 사유에 적는다). 엔티티 컬럼에 저장되는 워크스페이스 안 참조면 «검사한다»
 * 로 올리고 검사를 넣는다.
 */
const REFERENCE_FIELD_CATALOG: Readonly<Record<string, Classification>> = {
  // ── 검사한다 ──
  'CreateAlertRuleDto.workflowId': {
    checkedAt: ['modules/alerts/alerts.service.ts#create'],
  },
  'CreateAssistantSessionDto.llmConfigId': {
    checkedAt: [
      'modules/workflow-assistant/workflow-assistant-session.service.ts#create',
    ],
  },
  'CreateAssistantSessionDto.workflowId': {
    checkedAt: [
      'modules/workflow-assistant/workflow-assistant-session.service.ts#create',
    ],
  },
  'CreateEdgeDto.sourceNodeId': {
    checkedAt: ['modules/edges/edges.service.ts#create'],
  },
  'CreateEdgeDto.targetNodeId': {
    checkedAt: ['modules/edges/edges.service.ts#create'],
  },
  'CreateFolderDto.parentId': {
    checkedAt: ['modules/folders/folders.service.ts#create'],
  },
  'CreateKnowledgeBaseDto.embeddingModelConfigId': {
    checkedAt: ['modules/knowledge-base/knowledge-base.service.ts#create'],
  },
  'CreateKnowledgeBaseDto.extractionLlmConfigId': {
    checkedAt: ['modules/knowledge-base/knowledge-base.service.ts#create'],
  },
  'CreateKnowledgeBaseDto.rerankConfigId': {
    checkedAt: ['modules/knowledge-base/knowledge-base.service.ts#create'],
  },
  'CreateKnowledgeBaseDto.rerankLlmConfigId': {
    checkedAt: ['modules/knowledge-base/knowledge-base.service.ts#create'],
  },
  'CreateNodeDto.containerId': {
    checkedAt: ['modules/nodes/nodes.service.ts#create'],
  },
  'CreateNodeDto.toolOwnerId': {
    checkedAt: ['modules/nodes/nodes.service.ts#create'],
  },
  'CreateScheduleDto.workflowId': {
    checkedAt: ['modules/schedules/schedules.service.ts#create'],
  },
  'CreateTriggerDto.authConfigId': {
    checkedAt: ['modules/triggers/triggers.service.ts#create'],
  },
  'CreateTriggerDto.workflowId': {
    checkedAt: ['modules/triggers/triggers.service.ts#create'],
  },
  'CreateWorkflowDto.folderId': {
    checkedAt: ['modules/workflows/workflows.service.ts#create'],
  },
  'SaveCanvasEdgeDto.sourceNodeId': {
    checkedAt: ['modules/workflows/workflows.service.ts#saveCanvas'],
  },
  'SaveCanvasEdgeDto.targetNodeId': {
    checkedAt: ['modules/workflows/workflows.service.ts#saveCanvas'],
  },
  'SaveCanvasNodeDto.containerId': {
    checkedAt: ['modules/workflows/workflows.service.ts#saveCanvas'],
  },
  // 새 노드 id 가 이 워크플로 밖에서 이미 쓰이면 거부한다(`assertNewNodeIdsUnused`).
  'SaveCanvasNodeDto.id': {
    checkedAt: ['modules/workflows/workflows.service.ts#saveCanvas'],
  },
  'SaveCanvasNodeDto.toolOwnerId': {
    checkedAt: ['modules/workflows/workflows.service.ts#saveCanvas'],
  },
  'UpdateAssistantSessionDto.llmConfigId': {
    checkedAt: [
      'modules/workflow-assistant/workflow-assistant-session.service.ts#update',
    ],
  },
  'UpdateFolderDto.parentId': {
    checkedAt: ['modules/folders/folders.service.ts#update'],
  },
  'UpdateKnowledgeBaseDto.embeddingModelConfigId': {
    checkedAt: ['modules/knowledge-base/knowledge-base.service.ts#update'],
  },
  'UpdateKnowledgeBaseDto.extractionLlmConfigId': {
    checkedAt: ['modules/knowledge-base/knowledge-base.service.ts#update'],
  },
  'UpdateKnowledgeBaseDto.rerankConfigId': {
    checkedAt: ['modules/knowledge-base/knowledge-base.service.ts#update'],
  },
  'UpdateKnowledgeBaseDto.rerankLlmConfigId': {
    checkedAt: ['modules/knowledge-base/knowledge-base.service.ts#update'],
  },
  'UpdateNodeDto.containerId': {
    checkedAt: ['modules/nodes/nodes.service.ts#update'],
  },
  'UpdateNodeDto.toolOwnerId': {
    checkedAt: ['modules/nodes/nodes.service.ts#update'],
  },
  'UpdateTriggerDto.authConfigId': {
    checkedAt: ['modules/triggers/triggers.service.ts#update'],
  },
  'UpdateWorkflowDto.folderId': {
    checkedAt: ['modules/workflows/workflows.service.ts#update'],
  },

  // ── 범위 밖 ──
  'AssistantMessageRequestDto.llmConfigId': {
    outOfScope:
      '저장하지 않는다. 이번 메시지에 쓸 모델 설정이고 resolveConfig 가 워크스페이스로 걸러 찾는다',
  },
  'AssistantWorkflowEdgeDto.id': { outOfScope: SNAPSHOT_REASON },
  'AssistantWorkflowEdgeDto.sourceNodeId': { outOfScope: SNAPSHOT_REASON },
  'AssistantWorkflowEdgeDto.targetNodeId': { outOfScope: SNAPSHOT_REASON },
  'AssistantWorkflowNodeDto.containerId': { outOfScope: SNAPSHOT_REASON },
  'AssistantWorkflowNodeDto.id': { outOfScope: SNAPSHOT_REASON },
  'AssistantWorkflowNodeDto.toolOwnerId': { outOfScope: SNAPSHOT_REASON },
  'Cafe24PrecheckQueryDto.mallId': {
    outOfScope: '외부 시스템(Cafe24 쇼핑몰) id 다',
  },
  'ChatChannelBotIdentityDto.botId': {
    outOfScope: '외부 시스템(메신저 봇) id 다',
  },
  'EmbeddingProbeDto.embeddingModelConfigId': {
    outOfScope:
      '저장하지 않는다. 임베딩 연결 시험용이고 모델 설정은 워크스페이스로 걸러 찾는다',
  },
  'EmbeddingProbeDto.llmConfigId': {
    outOfScope:
      '저장하지 않는다. 임베딩 연결 시험용이고 모델 설정은 워크스페이스로 걸러 찾는다',
  },
  'ExecuteNodeDto.previousExecutionId': {
    outOfScope:
      '실행 행에 남지만 「참조의 소속」 표 밖이다. 컨트롤러가 같은 워크플로의 실행인지 따로 대조한다',
  },
  'InteractDto.buttonId': {
    outOfScope: '저장하지 않는다. 대기 중인 노드의 버튼을 고르는 입력이다',
  },
  'InteractDto.nodeId': {
    outOfScope:
      '저장하지 않는다. 대기 중인 실행의 노드와 맞는지 대조하는 입력이다',
  },
  'OAuthBeginDto.clientId': { outOfScope: '외부 OAuth 앱의 client id 다' },
  'OAuthBeginDto.integrationId': {
    outOfScope:
      'OAuth state 에만 싣고 엔티티 컬럼에 쓰지 않는다. 재연결 모드는 assertBeginMatchesTarget 이 대조한다',
  },
  'OAuthBeginDto.mallId': { outOfScope: '외부 시스템(쇼핑몰) id 다' },
  'QueryAuditLogDto.userId': { outOfScope: '조회 필터다. 저장하지 않는다' },
  'QueryScheduleDto.triggerId': { outOfScope: '조회 필터다. 저장하지 않는다' },
  'QueryStatisticsDto.workflowId': {
    outOfScope: '조회 필터다. 저장하지 않는다',
  },
  'QueryWorkflowDto.folderId': { outOfScope: '조회 필터다. 저장하지 않는다' },
  'RagSearchDto.knowledgeBaseIds': {
    outOfScope: '검색 대상 목록이다. 저장하지 않는다',
  },
  'SaveCanvasEdgeDto.id': {
    outOfScope:
      '저장하지 않는다. 캔버스 저장은 엣지를 모두 지우고 id 없이 다시 만든다(syncEdges)',
  },
  'TransferOwnershipDto.newOwnerMemberId': {
    outOfScope:
      '참조 컬럼으로 저장하지 않는다. workspaceId 조건으로 멤버를 찾아 역할만 바꾼다',
  },
};

/**
 * 검사 대상 필드를 나르는 DTO 를 받지만 저장하지 않는 공개 메서드. **지금은 비어 있다.**
 *
 * 빈 목록이 더 강한 상태다. 같은 DTO 를 받는 새 메서드가 생기면 3번 단언이 깨지고, 작성자는 검사를 넣어 카탈로그 자리 목록에
 * 올리거나 «저장하지 않는다» 는 사유를 달아 여기 올려야 한다.
 */
const EXPECTED_NON_WRITING_CONSUMERS: Readonly<Record<string, string>> = {};

function checkedAtMap(
  catalog: Readonly<Record<string, Classification>>,
): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  for (const [key, entry] of Object.entries(catalog)) {
    if ('checkedAt' in entry) out.set(key, entry.checkedAt);
  }
  return out;
}

describe('요청 참조 id 의 소속 검사 래칫', () => {
  const files = collectTsFiles(SRC_ROOT);
  const fields = findRequestReferenceFields(files, SRC_ROOT);
  const bearing = findReferenceBearingDtos(files, SRC_ROOT);
  const consumers = findPublicDtoConsumers(
    files,
    SRC_ROOT,
    new Set(bearing.keys()),
  );
  const checkedAt = checkedAtMap(REFERENCE_FIELD_CATALOG);

  it('[전제] 스캔이 비어 있지 않다. 0건이면 아래 단언이 조용히 통과한다', () => {
    const keys = fields.map((f) => f.key);
    expect(keys).toContain('CreateTriggerDto.workflowId');
    expect(keys).toContain('SaveCanvasNodeDto.containerId');
    // 바깥 DTO 가 항목 DTO 를 나르는 것을 읽어야 `saveCanvas` 가 3번에 잡힌다.
    expect([...(bearing.get('SaveCanvasDto') ?? [])].sort()).toEqual([
      'SaveCanvasEdgeDto',
      'SaveCanvasNodeDto',
    ]);
    expect(consumers.map((c) => c.key)).toContain(
      'modules/triggers/triggers.service.ts#create',
    );
  });

  it('[전제] fixture 는 프로덕션 모집단에 섞이지 않는다', () => {
    expect(fields.filter((f) => f.dto.startsWith('Fixture'))).toEqual([]);
  });

  it('1. 모집단과 카탈로그 키가 정확히 같다 (새 필드 · 사라진 필드 모두 실패)', () => {
    // **이 단언이 첫 관문이다.** 새 참조 필드는 여기서 멈춘다. 검사를 넣어 «검사한다» 로 올리거나 사유와 함께 «범위 밖» 으로
    // 올린다.
    expect(fields.map((f) => f.key).sort()).toEqual(
      Object.keys(REFERENCE_FIELD_CATALOG).sort(),
    );
  });

  it('카탈로그의 자리 목록은 비어 있지 않고 사유는 빈 문자열이 아니다', () => {
    const empty = Object.entries(REFERENCE_FIELD_CATALOG)
      .filter(([, entry]) =>
        'checkedAt' in entry
          ? entry.checkedAt.length === 0
          : entry.outOfScope.trim() === '',
      )
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('2. 검사한다고 적힌 자리는 그 필드를 검사하는 호출에 닿는다 (검사 호출을 지우면 실패)', () => {
    expect(findUnboundSites(SRC_ROOT, checkedAt)).toEqual([]);
  });

  it('3. 검사 대상 필드를 나르는 DTO 를 받는 공개 메서드는 자리 목록이나 예외 목록에 있다', () => {
    expect(
      findUncheckedConsumers(
        consumers,
        bearing,
        checkedAt,
        new Set(Object.keys(EXPECTED_NON_WRITING_CONSUMERS)),
      ),
    ).toEqual([]);
  });

  it('예외 목록의 메서드는 지금도 검사 대상 DTO 를 받는다 (낡은 항목 금지)', () => {
    const live = new Set(consumers.map((c) => c.key));
    expect(
      Object.keys(EXPECTED_NON_WRITING_CONSUMERS).filter((k) => !live.has(k)),
    ).toEqual([]);
  });
});

describe('[대조군] fixture 로 술어를 양쪽에서 확인한다', () => {
  const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'reference-scope');
  const files = collectTsFiles(FIXTURE_ROOT);
  const service = path.join(FIXTURE_ROOT, 'sample.service.ts');
  const reach = (method: string): string[] | null =>
    findScopeChecksReachableFrom(service, method)?.map((b) => b.field) ?? null;

  describe('요청 DTO 경로', () => {
    it.each([
      ['modules/a/dto/create-a.dto.ts', true],
      ['modules/a/dto/responses/a-response.dto.ts', false],
      ['modules/a/dto/responses/a.dto.ts', false],
      ['modules/a/dto/run-response.dto.ts', false],
      ['modules/a/create-a.dto.ts', false],
      [
        'repo-guards/__tests__/fixtures/reference-scope/dto/sample.dto.ts',
        false,
      ],
    ])('%s → %s', (rel, expected) => {
      expect(isRequestDtoPath(rel)).toBe(expected);
    });
  });

  it('모집단: 참조 모양 이름만 세고 응답 DTO 와 상속만 하는 DTO 는 뺀다', () => {
    expect(
      findRequestReferenceFields(files, FIXTURE_ROOT)
        .map((f) => f.key)
        .sort(),
    ).toEqual([
      'FixtureCreateDto.folderId',
      'FixtureCreateDto.id',
      'FixtureCreateDto.workflowId',
      'FixtureItemDto.containerId',
      'FixtureItemDto.knowledgeBaseIds',
    ]);
  });

  it('포함 관계: 상속 · 프로퍼티 타입 · 두 단계 중첩을 따라가고 참조 없는 DTO 는 뺀다', () => {
    const bearing = findReferenceBearingDtos(files, FIXTURE_ROOT);
    expect(
      Object.fromEntries(
        [...bearing].map(([dto, carried]) => [dto, [...carried].sort()]),
      ),
    ).toEqual({
      FixtureCreateDto: ['FixtureCreateDto'],
      FixtureUpdateDto: ['FixtureCreateDto'],
      FixtureItemDto: ['FixtureItemDto'],
      FixtureNestedDto: ['FixtureItemDto'],
      FixtureOuterDto: ['FixtureItemDto'],
    });
  });

  describe('검사 도달', () => {
    it.each([
      ['direct', ['workflowId']],
      ['viaPrivate', ['folderId']],
      ['collected', ['containerId', 'id']],
      ['firstArg', ['folderId']],
    ])('양성 %s → %j', (method, expected) => {
      expect(reach(method)?.sort()).toEqual(expected);
    });

    it.each([
      'noCheck',
      'mentionsOnly',
      'nonLiteralField',
      'otherObject',
      'plain',
    ])('음성 %s → 검사 없음', (method) => {
      expect(reach(method)).toEqual([]);
    });

    it('없는 메서드는 null 이다 (빈 배열과 구별한다)', () => {
      expect(reach('doesNotExist')).toBeNull();
    });

    it('같은 이름의 메서드가 두 클래스에 있으면 던진다', () => {
      expect(() => reach('duplicated')).toThrow(/클래스 2개/);
    });
  });

  it('공개 소비: 타입 연산자 · 인덱스 타입까지 보고 private · protected · 참조 없는 DTO 는 뺀다', () => {
    const bearing = findReferenceBearingDtos(files, FIXTURE_ROOT);
    const consumers = findPublicDtoConsumers(
      files,
      FIXTURE_ROOT,
      new Set(bearing.keys()),
    );
    expect(consumers.map((c) => `${c.key} ${c.dto}`).sort()).toEqual(
      [
        'sample.service.ts#collected FixtureNestedDto',
        'sample.service.ts#direct FixtureCreateDto',
        'sample.service.ts#firstArg FixtureCreateDto',
        'sample.service.ts#indexed FixtureNestedDto',
        'sample.service.ts#mentionsOnly FixtureCreateDto',
        'sample.service.ts#noCheck FixtureCreateDto',
        'sample.service.ts#nonLiteralField FixtureCreateDto',
        'sample.service.ts#otherObject FixtureCreateDto',
        'sample.service.ts#partial FixtureCreateDto',
        'sample.service.ts#viaPrivate FixtureUpdateDto',
      ].sort(),
    );
  });

  describe('판정 함수', () => {
    const bearing = findReferenceBearingDtos(files, FIXTURE_ROOT);
    const consumers = findPublicDtoConsumers(
      files,
      FIXTURE_ROOT,
      new Set(bearing.keys()),
    );

    it('자리 묶음: 닿으면 통과, 검사 없는 자리 · 없는 메서드 · 없는 파일은 위반이다', () => {
      expect(
        findUnboundSites(
          FIXTURE_ROOT,
          new Map([
            ['FixtureCreateDto.workflowId', ['sample.service.ts#direct']],
            ['FixtureCreateDto.folderId', ['sample.service.ts#viaPrivate']],
            ['FixtureItemDto.containerId', ['sample.service.ts#collected']],
          ]),
        ),
      ).toEqual([]);
      expect(
        findUnboundSites(
          FIXTURE_ROOT,
          new Map([
            [
              'FixtureCreateDto.workflowId',
              [
                'sample.service.ts#noCheck',
                'sample.service.ts#mentionsOnly',
                'sample.service.ts#gone',
                'missing.service.ts#create',
              ],
            ],
            // 다른 필드를 검사하는 자리는 이 필드를 검사하지 않는다.
            ['FixtureCreateDto.id', ['sample.service.ts#direct']],
          ]),
        ),
      ).toEqual(
        [
          'missing.service.ts#create: 파일이 없다 (FixtureCreateDto.workflowId)',
          'sample.service.ts#direct: FixtureCreateDto.id 를 검사하는 호출에 닿지 않는다',
          'sample.service.ts#gone: 메서드가 없다 (FixtureCreateDto.workflowId)',
          'sample.service.ts#mentionsOnly: FixtureCreateDto.workflowId 를 검사하는 호출에 닿지 않는다',
          'sample.service.ts#noCheck: FixtureCreateDto.workflowId 를 검사하는 호출에 닿지 않는다',
        ].sort(),
      );
    });

    it('공개 소비: 자리 목록 · 예외 목록에 없는 소비 메서드를 상속 · 중첩 DTO 까지 잡는다', () => {
      const checked = new Map<string, readonly string[]>([
        [
          'FixtureCreateDto.workflowId',
          ['sample.service.ts#direct', 'sample.service.ts#viaPrivate'],
        ],
        ['FixtureItemDto.containerId', ['sample.service.ts#collected']],
      ]);
      const exempt = new Set([
        'sample.service.ts#firstArg',
        'sample.service.ts#mentionsOnly',
        'sample.service.ts#nonLiteralField',
        'sample.service.ts#otherObject',
        'sample.service.ts#partial',
      ]);
      expect(
        findUncheckedConsumers(consumers, bearing, checked, exempt),
      ).toEqual([
        'sample.service.ts#indexed ← FixtureItemDto.containerId',
        'sample.service.ts#noCheck ← FixtureCreateDto.workflowId',
      ]);
    });
  });
});
