import { NextResponse } from 'next/server';
import { getProposal, updateProposalStatus, deleteProposal, emitEvent } from '@/lib/ops';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const proposal = getProposal(parseInt(id));

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    return NextResponse.json({ proposal });
  } catch (error) {
    console.error('[ops/proposals/[id]] GET error:', error);
    return NextResponse.json({ error: 'Failed to get proposal' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, rejectionReason } = body;

    if (!status) {
      return NextResponse.json({ error: 'Missing required field: status' }, { status: 400 });
    }

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be: approved, rejected, or pending' }, { status: 400 });
    }

    const proposal = updateProposalStatus(parseInt(id), status, rejectionReason);

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    emitEvent(`proposal_${status}`, 'system', { proposalId: proposal.id, title: proposal.title });

    return NextResponse.json({ success: true, proposal });
  } catch (error) {
    console.error('[ops/proposals/[id]] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = deleteProposal(parseInt(id));

    if (!deleted) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    emitEvent('proposal_deleted', 'system', { proposalId: parseInt(id) });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ops/proposals/[id]] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete proposal' }, { status: 500 });
  }
}
